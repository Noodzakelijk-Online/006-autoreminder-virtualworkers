import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import analyticsRoutes from './routes/analytics';
import reportsRoutes from './routes/reports';
import metricsRoutes from './routes/metrics';
import batchOperationRoutes from './routes/batch-operations';
import advancedSchedulingRoutes from './routes/advanced-scheduling';

const worker = {
  id: 42,
  openId: 'worker-42',
  role: 'worker',
};

function appWithUser(user?: typeof worker | { id: number; openId: string; role: 'admin' }) {
  const app = express();
  app.use(express.json());
  if (user) app.use((req, _res, next) => {
    (req as any).user = user;
    next();
  });
  app.use('/analytics', analyticsRoutes);
  app.use('/reports', reportsRoutes);
  app.use('/metrics-api', metricsRoutes);
  app.use('/batch-operations', batchOperationRoutes);
  app.use('/scheduling', advancedSchedulingRoutes);
  return app;
}

describe('legacy API hardening', () => {
  it('requires authentication for analytics, reports, and batch operations', async () => {
    const app = appWithUser();
    await request(app).get('/analytics/team-capacity').expect(401);
    await request(app).get('/reports/export?format=csv&type=time-entries').expect(401);
    await request(app).get('/batch-operations/job/status').expect(401);
  });

  it('does not report placeholder batch algorithms as successful', async () => {
    const app = appWithUser(worker);
    const response = await request(app)
      .post('/batch-operations/start')
      .send({ operationType: 'optimization', taskIds: ['task-1'] })
      .expect(501);

    expect(response.body.supportedOperationTypes).toEqual(['re_analyze', 'reschedule']);

    await request(app)
      .post('/scheduling/batch-start')
      .send({ operationType: 'conflict_resolution', taskIds: ['task-1'] })
      .expect(501);
  });

  it('restricts destructive metric resets to admins', async () => {
    const workerApp = appWithUser(worker);
    await request(workerApp).post('/metrics-api/metrics/reset').expect(403);

    const adminApp = appWithUser({ id: 1, openId: 'admin-1', role: 'admin' });
    await request(adminApp).post('/metrics-api/metrics/reset').expect(200);
  });

  it('describes supported report exports instead of fabricating a PDF', async () => {
    const app = appWithUser(worker);
    const response = await request(app)
      .get('/reports/export?format=pdf&type=task-summary')
      .expect(400);
    expect(response.body.supported).toEqual(['csv/time-entries', 'csv/task-summary']);
  });
});
