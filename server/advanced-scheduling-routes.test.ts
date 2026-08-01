import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const schedulingMocks = vi.hoisted(() => ({
  getScheduledTaskForActor: vi.fn(),
  getUserTasks: vi.fn(),
  getTasksByAssignee: vi.fn(),
  rescheduleTaskForActor: vi.fn(),
  undoLastRescheduleForActor: vi.fn(),
  getScheduleHistoryForActor: vi.fn(),
}));

vi.mock('./db/scheduling', async () => {
  const actual = await vi.importActual<typeof import('./db/scheduling')>('./db/scheduling');
  return { ...actual, ...schedulingMocks };
});

import advancedSchedulingRoutes from './routes/advanced-scheduling';

const actor = {
  id: 7,
  openId: 'founder-7',
  role: 'admin',
};

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = actor;
    next();
  });
  app.use('/scheduling', advancedSchedulingRoutes);
  return app;
}

const ownedTask = {
  id: 11,
  taskId: 'trello-card-1',
  vaId: 4,
  founderId: actor.id,
  startTime: new Date('2026-08-03T08:00:00.000Z'),
  endTime: new Date('2026-08-03T09:00:00.000Z'),
  status: 'assigned',
};

describe('advanced scheduling persistence and ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    schedulingMocks.getScheduledTaskForActor.mockResolvedValue(ownedTask);
    schedulingMocks.getUserTasks.mockResolvedValue([ownedTask]);
    schedulingMocks.getTasksByAssignee.mockResolvedValue([ownedTask]);
  });

  it('rejects invalid dates before touching persisted task data', async () => {
    const response = await request(createApp())
      .post('/scheduling/reschedule')
      .send({ taskId: ownedTask.taskId, newStartTime: 'invalid', newEndTime: 'also-invalid' })
      .expect(400);

    expect(response.body.error).toMatch(/Valid start and end times/);
    expect(schedulingMocks.getScheduledTaskForActor).not.toHaveBeenCalled();
    expect(schedulingMocks.rescheduleTaskForActor).not.toHaveBeenCalled();
  });

  it('does not expose or reschedule a task outside the actor scope', async () => {
    schedulingMocks.getScheduledTaskForActor.mockResolvedValue(null);

    await request(createApp())
      .post('/scheduling/reschedule')
      .send({
        taskId: 'someone-elses-task',
        newStartTime: '2026-08-03T10:00:00.000Z',
        newEndTime: '2026-08-03T11:00:00.000Z',
      })
      .expect(404);

    expect(schedulingMocks.rescheduleTaskForActor).not.toHaveBeenCalled();
  });

  it('persists the assignment change and returns the durable history record', async () => {
    schedulingMocks.rescheduleTaskForActor.mockResolvedValue({
      historyId: 'history-1',
      taskId: ownedTask.taskId,
      previousStartTime: ownedTask.startTime,
      previousEndTime: ownedTask.endTime,
      newStartTime: new Date('2026-08-03T10:00:00.000Z'),
      newEndTime: new Date('2026-08-03T11:00:00.000Z'),
      vaId: ownedTask.vaId,
    });

    const response = await request(createApp())
      .post('/scheduling/reschedule')
      .send({
        taskId: ownedTask.taskId,
        newStartTime: '2026-08-03T10:00:00.000Z',
        newEndTime: '2026-08-03T11:00:00.000Z',
        reason: 'Calendar drag',
      })
      .expect(200);

    expect(response.body).toMatchObject({ success: true, historyId: 'history-1', hadConflicts: false });
    expect(schedulingMocks.rescheduleTaskForActor).toHaveBeenCalledWith(
      actor,
      ownedTask.taskId,
      new Date('2026-08-03T10:00:00.000Z'),
      new Date('2026-08-03T11:00:00.000Z'),
      expect.objectContaining({ reason: 'Calendar drag', source: 'manual' }),
    );
  });

  it('uses the owner-scoped atomic undo operation', async () => {
    schedulingMocks.undoLastRescheduleForActor.mockResolvedValue({
      historyId: 'history-undo',
      taskId: ownedTask.taskId,
      newStartTime: ownedTask.startTime,
      newEndTime: ownedTask.endTime,
      vaId: ownedTask.vaId,
    });

    const response = await request(createApp())
      .post(`/scheduling/undo/${ownedTask.taskId}`)
      .expect(200);

    expect(response.body).toMatchObject({
      historyId: 'history-undo',
      restoredStartTime: ownedTask.startTime.toISOString(),
      restoredEndTime: ownedTask.endTime.toISOString(),
    });
    expect(schedulingMocks.undoLastRescheduleForActor).toHaveBeenCalledWith(actor, ownedTask.taskId);
  });

  it('hides schedule history for an unowned task', async () => {
    schedulingMocks.getScheduleHistoryForActor.mockResolvedValue(null);

    await request(createApp())
      .get('/scheduling/history/someone-elses-task')
      .expect(404);
  });

  it('does not start a batch reschedule without explicit timing', async () => {
    const response = await request(createApp())
      .post('/scheduling/batch-start')
      .send({ operationType: 'reschedule', taskIds: [ownedTask.taskId] })
      .expect(400);

    expect(response.body.error).toMatch(/requires a valid schedule/);
  });
});
