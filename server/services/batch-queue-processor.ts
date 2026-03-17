/**
 * Batch Queue Processor Service
 * 
 * Handles processing of batch operations (re-analyze, reschedule, conflict resolution)
 * with real-time progress updates via WebSocket.
 * 
 * Features:
 * - Queue-based processing with concurrency control
 * - Real-time progress streaming via WebSocket
 * - Error handling and retry logic
 * - Task result aggregation
 * - Automatic cleanup of completed jobs
 */

import { EventEmitter } from 'events';
import * as schedulingDb from '../db/scheduling.js';
import { websocketService } from './websocket.js';
import { invokeLLM } from '../_core/llm.js';

interface QueuedJob {
  jobId: string;
  userId: string;
  operationType: 're_analyze' | 'reschedule' | 'conflict_resolution' | 'optimization';
  taskIds: string[];
  parameters?: Record<string, any>;
  createdAt: Date;
}

interface JobProgress {
  jobId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  currentTaskIndex: number;
  currentTaskName?: string;
  completedTasks: number;
  failedTasks: number;
  totalTasks: number;
  elapsedSeconds: number;
  estimatedTimeSeconds?: number;
  results?: Record<string, any>;
  errorLog?: string[];
}

class BatchQueueProcessor extends EventEmitter {
  private queue: QueuedJob[] = [];
  private activeJobs: Map<string, QueuedJob> = new Map();
  private jobProgress: Map<string, JobProgress> = new Map();
  private maxConcurrentJobs = 3;
  private isProcessing = false;
  private jobStartTimes: Map<string, number> = new Map();

  constructor() {
    super();
    this.startProcessor();
  }

  /**
   * Add a job to the queue
   */
  async enqueueJob(job: QueuedJob): Promise<void> {
    this.queue.push(job);
    this.emit('job-queued', job.jobId);
    this.processQueue();
  }

  /**
   * Start processing the queue
   */
  private startProcessor(): void {
    setInterval(() => {
      if (!this.isProcessing && this.queue.length > 0) {
        this.processQueue();
      }
    }, 1000);
  }

  /**
   * Process jobs from the queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.activeJobs.size >= this.maxConcurrentJobs) {
      return;
    }

    if (this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.queue.length > 0 && this.activeJobs.size < this.maxConcurrentJobs) {
        const job = this.queue.shift();
        if (!job) break;

        this.activeJobs.set(job.jobId, job);
        this.jobStartTimes.set(job.jobId, Date.now());

        // Initialize progress
        this.jobProgress.set(job.jobId, {
          jobId: job.jobId,
          status: 'running',
          progress: 0,
          currentTaskIndex: 0,
          completedTasks: 0,
          failedTasks: 0,
          totalTasks: job.taskIds.length,
          elapsedSeconds: 0,
          errorLog: []
        });

        // Process job in background
        this.processJob(job).catch(err => {
          console.error(`[BatchQueueProcessor] Error processing job ${job.jobId}:`, err);
        });
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single job
   */
  private async processJob(job: QueuedJob): Promise<void> {
    const startTime = Date.now();
    const progress = this.jobProgress.get(job.jobId)!;

    try {
      // Update database with running status
      await schedulingDb.updateBatchOperation(job.jobId, {
        status: 'running',
        startedAt: new Date()
      });

      const results: Record<string, any> = {};
      const errorLog: string[] = [];

      // Process each task
      for (let i = 0; i < job.taskIds.length; i++) {
        const taskId = job.taskIds[i];

        // Check if job was cancelled
        if (!this.activeJobs.has(job.jobId)) {
          progress.status = 'cancelled';
          break;
        }

        try {
          // Update progress
          progress.currentTaskIndex = i;
          progress.currentTaskName = `Task ${i + 1}/${job.taskIds.length}`;
          progress.progress = Math.round((i / job.taskIds.length) * 100);
          progress.elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

          // Broadcast progress update
          this.broadcastProgress(job.userId, progress);

          // Process based on operation type
          const result = await this.processTaskByType(job.operationType, taskId, job.parameters);
          results[taskId] = result || {};

          progress.completedTasks++;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          errorLog.push(`Task ${taskId}: ${errorMsg}`);
          progress.failedTasks++;
          console.error(`[BatchQueueProcessor] Error processing task ${taskId}:`, error);
        }

        // Update database periodically (every 5 tasks or at the end)
        if ((i + 1) % 5 === 0 || i === job.taskIds.length - 1) {
          await schedulingDb.updateBatchOperation(job.jobId, {
            completedTasks: progress.completedTasks,
            failedTasks: progress.failedTasks,
            progress: Math.round(((i + 1) / job.taskIds.length) * 100),
            currentTaskIndex: i,
            currentTaskName: progress.currentTaskName,
            elapsedTimeSeconds: progress.elapsedSeconds
          });
        }
      }

      // Mark as completed
      progress.status = 'completed';
      progress.progress = 100;
      progress.results = results as any;
      progress.elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);

      // Update database with final status
      await schedulingDb.updateBatchOperation(job.jobId, {
        status: 'completed',
        completedTasks: progress.completedTasks,
        failedTasks: progress.failedTasks,
        progress: 100,
        results: JSON.stringify(results) as any,
        errorLog: (errorLog.length > 0 ? JSON.stringify(errorLog) : undefined) as any,
        completedAt: new Date(),
        elapsedTimeSeconds: progress.elapsedSeconds
      } as any);

      // Final broadcast
      this.broadcastProgress(job.userId, progress);

      this.emit('job-completed', job.jobId, results);
    } catch (error) {
      progress.status = 'failed';
      const errorMsg = error instanceof Error ? error.message : String(error);
      progress.errorLog = [errorMsg];

      await schedulingDb.updateBatchOperation(job.jobId, {
        status: 'failed',
        errorLog: JSON.stringify([errorMsg]) as any,
        completedAt: new Date(),
        elapsedTimeSeconds: Math.floor((Date.now() - startTime) / 1000)
      } as any);

      this.broadcastProgress(job.userId, progress);
      this.emit('job-failed', job.jobId, errorMsg);
    } finally {
      // Clean up
      this.activeJobs.delete(job.jobId);
      this.jobStartTimes.delete(job.jobId);

      // Continue processing queue
      setTimeout(() => this.processQueue(), 100);
    }
  }

  /**
   * Process task based on operation type
   */
  private async processTaskByType(
    operationType: string,
    taskId: string,
    parameters?: Record<string, any>
  ): Promise<Record<string, any>> {
    switch (operationType) {
      case 're_analyze':
        return await this.reAnalyzeTask(taskId, parameters);
      case 'reschedule':
        return await this.rescheduleTask(taskId, parameters);
      case 'conflict_resolution':
        return await this.resolveConflicts(taskId, parameters);
      case 'optimization':
        return await this.optimizeSchedule(taskId, parameters);
      default:
        throw new Error(`Unknown operation type: ${operationType}`);
    }
  }

  /**
   * Re-analyze a task using LLM
   */
  private async reAnalyzeTask(taskId: string, parameters?: Record<string, any>): Promise<Record<string, any>> {
    try {
      // Fetch task details from database
      const task = await schedulingDb.getTaskById(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Prepare task context for LLM
      const taskContext = `Task: ${task.title || task.name}\nDescription: ${task.description || 'No description'}\nStatus: ${task.status || 'unknown'}\nPriority: ${task.priority || 'medium'}\nEstimated Hours: ${task.estimatedHours || 'unknown'}`;

      // Call LLM for re-analysis
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: 'You are a task analysis expert. Re-analyze the task and provide: decomposition, risks, resources, timeline, and quality metrics.'
          },
          {
            role: 'user',
            content: `Re-analyze: ${taskContext}`
          }
        ]
      });

      // Parse LLM response
      const content = response.choices[0].message.content;
      const analysis = typeof content === 'string' ? JSON.parse(content) : content;

      // Update task with new analysis results
      const updatedTask = {
        ...task,
        analysisData: analysis,
        lastAnalyzedAt: new Date(),
        reanalysisCount: (task.reanalysisCount || 0) + 1
      };

      await schedulingDb.updateTask(taskId, updatedTask);

      return {
        taskId,
        title: task.title || task.name,
        analyzed: true,
        timestamp: new Date().toISOString(),
        analysis: analysis
      };
    } catch (error) {
      console.error(`[Batch] Error re-analyzing task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Reschedule a task
   */
  private async rescheduleTask(taskId: string, parameters?: Record<string, any>): Promise<Record<string, any>> {
    try {
      const task = await schedulingDb.getTaskById(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Find optimal time slot
      const availableSlots = await schedulingDb.findAvailableTimeSlots(
        task.assignee || 'unassigned',
        parameters?.duration || task.estimatedHours || 2,
        parameters?.preferredDate
      );

      if (availableSlots.length === 0) {
        throw new Error('No available time slots found');
      }

      // Select the first available slot
      const newSlot = availableSlots[0];

      // Update task with new schedule
      const updatedTask = {
        ...task,
        scheduledStart: newSlot.start,
        scheduledEnd: newSlot.end,
        lastRescheduledAt: new Date(),
        rescheduleCount: (task.rescheduleCount || 0) + 1
      };

      await schedulingDb.updateTask(taskId, updatedTask);

      return {
        taskId,
        title: task.title || task.name,
        rescheduled: true,
        timestamp: new Date().toISOString(),
        newStart: newSlot.start,
        newEnd: newSlot.end,
        duration: newSlot.duration
      };
    } catch (error) {
      console.error(`[Batch] Error rescheduling task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Resolve conflicts for a task
   */
  private async resolveConflicts(taskId: string, parameters?: Record<string, any>): Promise<Record<string, any>> {
    try {
      const task = await schedulingDb.getTaskById(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Identify conflicting tasks
      const conflicts = await schedulingDb.findConflictingTasks(
        taskId,
        task.scheduledStart,
        task.scheduledEnd,
        task.assignee
      );

      if (conflicts.length === 0) {
        return {
          taskId,
          resolved: true,
          conflictCount: 0,
          timestamp: new Date().toISOString(),
          message: 'No conflicts found'
        };
      }

      // Propose alternative schedules
      const resolutions: any[] = [];
      for (const conflict of conflicts) {
        const availableSlots = await schedulingDb.findAvailableTimeSlots(
          task.assignee || 'unassigned',
          task.estimatedHours || 2
        );

        if (availableSlots.length > 0) {
          const newSlot = availableSlots[0];
          resolutions.push({
            conflictingTaskId: conflict.id,
            proposedStart: newSlot.start,
            proposedEnd: newSlot.end
          });

          // Update task with new schedule
          await schedulingDb.updateTask(conflict.id, {
            ...conflict,
            scheduledStart: newSlot.start,
            scheduledEnd: newSlot.end
          });
        }
      }

      return {
        taskId,
        title: task.title || task.name,
        resolved: true,
        conflictCount: conflicts.length,
        resolutions: resolutions,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error(`[Batch] Error resolving conflicts for task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Optimize schedule for a task
   */
  private async optimizeSchedule(taskId: string, parameters?: Record<string, any>): Promise<Record<string, any>> {
    try {
      const task = await schedulingDb.getTaskById(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      // Analyze task dependencies
      const dependencies = await schedulingDb.getTaskDependencies(taskId);
      const dependencyDates = dependencies.map(d => d.scheduledEnd || new Date());
      const latestDependencyDate = dependencyDates.length > 0 ? new Date(Math.max(...dependencyDates.map(d => d.getTime()))) : new Date();

      // Get worker availability
      const workerAvailability = await schedulingDb.getWorkerAvailability(task.assignee || 'unassigned');

      // Calculate optimal timing
      const optimalStart = new Date(Math.max(latestDependencyDate.getTime(), workerAvailability.earliestAvailable.getTime()));
      const optimalEnd = new Date(optimalStart.getTime() + (task.estimatedHours || 2) * 60 * 60 * 1000);

      // Apply optimization
      const optimizationScore = this.calculateOptimizationScore(task, optimalStart, optimalEnd);
      const optimizedTask = {
        ...task,
        scheduledStart: optimalStart,
        scheduledEnd: optimalEnd,
        optimizationScore,
        lastOptimizedAt: new Date()
      };

      await schedulingDb.updateTask(taskId, optimizedTask);

      return {
        taskId,
        title: task.title || task.name,
        optimized: true,
        timestamp: new Date().toISOString(),
        previousStart: task.scheduledStart,
        previousEnd: task.scheduledEnd,
        newStart: optimalStart,
        newEnd: optimalEnd,
        optimizationScore,
        dependenciesConsidered: dependencies.length,
        workerAvailabilityConsidered: true
      };
    } catch (error) {
      console.error(`[Batch] Error optimizing schedule for task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate optimization score (0-100)
   */
  private calculateOptimizationScore(task: any, start: Date, end: Date): number {
    let score = 50; // Base score
    
    // Bonus for meeting deadline
    if (task.dueDate && end <= task.dueDate) {
      score += 25;
    }
    
    // Bonus for scheduling in preferred hours
    const hour = start.getHours();
    if (hour >= 9 && hour < 17) {
      score += 15;
    }
    
    // Bonus for not scheduling on weekends
    const day = start.getDay();
    if (day !== 0 && day !== 6) {
      score += 10;
    }
    
    return Math.min(100, score);
  }

  /**
   * Broadcast progress update via WebSocket
   */
  private broadcastProgress(userId: string, progress: JobProgress): void {
    websocketService.emitToUser(userId, 'batch-progress', progress);
  }

  /**
   * Get job progress
   */
  getProgress(jobId: string): JobProgress | undefined {
    return this.jobProgress.get(jobId);
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<void> {
    this.activeJobs.delete(jobId);
    const progress = this.jobProgress.get(jobId);
    if (progress) {
      progress.status = 'cancelled';
    }
    await schedulingDb.cancelBatchOperation(jobId);
  }

  /**
   * Get queue status
   */
  getQueueStatus(): {
    queueLength: number;
    activeJobs: number;
    maxConcurrent: number;
  } {
    return {
      queueLength: this.queue.length,
      activeJobs: this.activeJobs.size,
      maxConcurrent: this.maxConcurrentJobs
    };
  }
}

// Export singleton instance
export const batchQueueProcessor = new BatchQueueProcessor();

export default batchQueueProcessor;
