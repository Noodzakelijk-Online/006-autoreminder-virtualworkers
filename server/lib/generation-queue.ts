import { EventEmitter } from 'events';

interface QueueItem {
  id: string;
  cardId: string;
  cardData: any;
  settings: any;
  attempts: number;
  maxAttempts: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  result?: any;
  createdAt: Date;
  updatedAt: Date;
}

interface GenerationJob {
  id: string;
  totalCards: number;
  completedCards: number;
  failedCards: number;
  status: 'running' | 'paused' | 'completed' | 'failed';
  items: QueueItem[];
  createdAt: Date;
  completedAt?: Date;
}

export class GenerationQueue extends EventEmitter {
  private queue: QueueItem[] = [];
  private processing: boolean = false;
  private paused: boolean = false;
  private jobs: Map<string, GenerationJob> = new Map();
  private currentJobId: string | null = null;
  private concurrency: number = 1;
  private activeWorkers: number = 0;

  constructor(concurrency: number = 1) {
    super();
    this.concurrency = concurrency;
  }

  /**
   * Add items to the queue
   */
  addJob(jobId: string, cards: any[], settings: any): string {
    const items: QueueItem[] = cards.map((card, index) => ({
      id: `${jobId}-${index}`,
      cardId: card.id,
      cardData: card,
      settings,
      attempts: 0,
      maxAttempts: settings.maxRetries || 3,
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    const job: GenerationJob = {
      id: jobId,
      totalCards: cards.length,
      completedCards: 0,
      failedCards: 0,
      status: 'running',
      items,
      createdAt: new Date()
    };

    this.jobs.set(jobId, job);
    this.queue.push(...items);
    this.currentJobId = jobId;

    this.emit('job:created', job);
    
    if (!this.processing) {
      this.start();
    }

    return jobId;
  }

  /**
   * Start processing the queue
   */
  start() {
    if (this.processing) return;
    this.processing = true;
    this.paused = false;
    this.emit('queue:started');
    this.processQueue();
  }

  /**
   * Pause the queue
   */
  pause() {
    this.paused = true;
    this.emit('queue:paused');
  }

  /**
   * Resume the queue
   */
  resume() {
    if (!this.processing) {
      this.start();
    } else {
      this.paused = false;
      this.emit('queue:resumed');
      this.processQueue();
    }
  }

  /**
   * Stop the queue
   */
  stop() {
    this.processing = false;
    this.paused = false;
    this.emit('queue:stopped');
  }

  /**
   * Get job status
   */
  getJob(jobId: string): GenerationJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAllJobs(): GenerationJob[] {
    return Array.from(this.jobs.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  /**
   * Retry failed items in a job
   */
  retryFailedItems(jobId: string) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const failedItems = job.items.filter(item => item.status === 'failed');
    
    failedItems.forEach(item => {
      item.status = 'pending';
      item.attempts = 0;
      item.error = undefined;
      item.updatedAt = new Date();
    });

    this.queue.push(...failedItems);
    job.status = 'running';
    job.failedCards = 0;

    this.emit('job:retry', job);

    if (!this.processing) {
      this.start();
    }
  }

  /**
   * Process the queue
   */
  private async processQueue() {
    while (this.processing && !this.paused && this.queue.length > 0) {
      // Process items concurrently
      const batch = this.queue.splice(0, this.concurrency - this.activeWorkers);
      
      await Promise.all(
        batch.map(item => this.processItem(item))
      );

      // Small delay between batches
      await this.delay(100);
    }

    // Check if all jobs are complete
    if (this.queue.length === 0 && this.activeWorkers === 0) {
      this.processing = false;
      this.emit('queue:completed');
      
      // Mark current job as completed
      if (this.currentJobId) {
        const job = this.jobs.get(this.currentJobId);
        if (job) {
          job.status = 'completed';
          job.completedAt = new Date();
          this.emit('job:completed', job);
        }
      }
    }
  }

  /**
   * Process a single item
   */
  private async processItem(item: QueueItem) {
    this.activeWorkers++;
    item.status = 'processing';
    item.updatedAt = new Date();

    const job = Array.from(this.jobs.values()).find(j => 
      j.items.some(i => i.id === item.id)
    );

    this.emit('item:processing', item);

    try {
      // Call the generation function
      const result = await this.generateAPTLSS(item.cardData, item.settings);
      
      if (result.success) {
        item.status = 'completed';
        item.result = result;
        
        if (job) {
          job.completedCards++;
        }

        this.emit('item:completed', item);
      } else {
        throw new Error(result.error || 'Generation failed');
      }
    } catch (error: any) {
      item.attempts++;
      item.error = error.message;

      // Retry with exponential backoff
      if (item.attempts < item.maxAttempts) {
        const delay = Math.pow(2, item.attempts) * 1000; // 2s, 4s, 8s...
        
        this.emit('item:retry', { item, delay });
        
        await this.delay(delay);
        
        item.status = 'pending';
        this.queue.push(item);
      } else {
        item.status = 'failed';
        
        if (job) {
          job.failedCards++;
        }

        this.emit('item:failed', item);
      }
    } finally {
      item.updatedAt = new Date();
      this.activeWorkers--;
    }
  }

  /**
   * Generate APTLSS (to be implemented by caller)
   */
  private async generateAPTLSS(cardData: any, settings: any): Promise<any> {
    // This will be overridden by the actual implementation
    throw new Error('generateAPTLSS not implemented');
  }

  /**
   * Set the generation function
   */
  setGenerationFunction(fn: (cardData: any, settings: any) => Promise<any>) {
    this.generateAPTLSS = fn;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const generationQueue = new GenerationQueue(3); // 3 concurrent workers
