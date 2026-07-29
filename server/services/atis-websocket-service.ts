import {
  broadcastProgressUpdate,
  broadcastPhaseCompletion,
  broadcastAnalysisComplete,
  broadcastError,
  broadcastConfidenceUpdate,
} from '../_core/websocket';
import type {
  AnalysisProgressUpdate,
  PhaseCompletionEvent,
  AnalysisCompleteEvent,
  WebSocketError,
} from '../_core/websocket';

/**
 * Service for broadcasting ATIS analysis progress via WebSocket
 */
export class ATISWebSocketService {
  /**
   * Broadcast phase started event
   */
  static broadcastPhaseStarted(
    sessionId: string,
    taskId: string,
    phase: number
  ): void {
    const update: AnalysisProgressUpdate = {
      sessionId,
      taskId,
      phase,
      status: 'started',
      progress: 0,
      timestamp: Date.now(),
    };
    broadcastProgressUpdate(update);
  }

  /**
   * Broadcast phase in progress event with confidence update
   */
  static broadcastPhaseProgress(
    sessionId: string,
    taskId: string,
    phase: number,
    progress: number,
    confidence: number
  ): void {
    const update: AnalysisProgressUpdate = {
      sessionId,
      taskId,
      phase,
      status: 'in_progress',
      progress,
      confidence,
      timestamp: Date.now(),
    };
    broadcastProgressUpdate(update);
    broadcastConfidenceUpdate(sessionId, phase, confidence);
  }

  /**
   * Broadcast phase completed event
   */
  static broadcastPhaseCompleted(
    sessionId: string,
    phase: number,
    duration: number,
    confidence: number
  ): void {
    const event: PhaseCompletionEvent = {
      sessionId,
      phase,
      duration,
      confidence,
      timestamp: Date.now(),
    };
    broadcastPhaseCompletion(event);
  }

  /**
   * Broadcast analysis completion event
   */
  static broadcastAnalysisCompleted(
    sessionId: string,
    taskId: string,
    overallConfidence: number,
    completedPhases: number,
    totalPhases: number,
    totalDuration: number
  ): void {
    const event: AnalysisCompleteEvent = {
      sessionId,
      taskId,
      overallConfidence,
      completedPhases,
      totalPhases,
      totalDuration,
      timestamp: Date.now(),
    };
    broadcastAnalysisComplete(event);
  }

  /**
   * Broadcast analysis error event
   */
  static broadcastAnalysisError(
    sessionId: string,
    phase: number,
    error: string
  ): void {
    const errorEvent: WebSocketError = {
      sessionId,
      phase,
      error,
      timestamp: Date.now(),
    };
    broadcastError(errorEvent);
  }

  /**
   * Broadcast phase failed event
   */
  static broadcastPhaseFailed(
    sessionId: string,
    taskId: string,
    phase: number,
    error: string
  ): void {
    const update: AnalysisProgressUpdate = {
      sessionId,
      taskId,
      phase,
      status: 'failed',
      error,
      timestamp: Date.now(),
    };
    broadcastProgressUpdate(update);
    this.broadcastAnalysisError(sessionId, phase, error);
  }

  /**
   * Broadcast confidence score update for a phase
   */
  static broadcastConfidenceScore(
    sessionId: string,
    phase: number,
    confidence: number
  ): void {
    broadcastConfidenceUpdate(sessionId, phase, confidence);
  }

  /**
   * Simulate analysis progress for testing
   */
  static async simulateAnalysisProgress(
    sessionId: string,
    taskId: string,
    phases: number[] = [3, 4, 5, 6, 7, 8, 9, 10]
  ): Promise<void> {
    const startTime = Date.now();

    for (const phase of phases) {
      try {
        // Phase started
        this.broadcastPhaseStarted(sessionId, taskId, phase);
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Phase in progress (simulate multiple updates)
        for (let progress = 20; progress <= 100; progress += 20) {
          const confidence = Math.min(95, 50 + progress * 0.45);
          this.broadcastPhaseProgress(sessionId, taskId, phase, progress, confidence);
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        // Phase completed
        const phaseStartTime = Date.now();
        const duration = phaseStartTime - startTime;
        const finalConfidence = 80 + Math.random() * 15;
        this.broadcastPhaseCompleted(sessionId, phase, duration, finalConfidence);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.broadcastPhaseFailed(sessionId, taskId, phase, errorMessage);
      }
    }

    // Analysis completed
    const totalDuration = Date.now() - startTime;
    const overallConfidence = 85 + Math.random() * 10;
    this.broadcastAnalysisCompleted(
      sessionId,
      taskId,
      overallConfidence,
      phases.length,
      phases.length,
      totalDuration
    );
  }
}
