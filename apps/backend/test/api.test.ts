import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
process.env.WRITE_API_KEY = 'test-write-key';

const mod = await import('../src/main');
const app = mod.app;
const prisma = mod.prisma;
const ensureDefaultPolicy = mod.ensureDefaultPolicy;

describe('ERP API', () => {
  let revisionId = '';

  beforeAll(async () => {
    await ensureDefaultPolicy();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates device and revision', async () => {
    const deviceRes = await request(app).post('/devices').set('x-api-key', 'test-write-key').send({ name: 'Mic V2' });
    expect(deviceRes.status).toBe(201);

    const revRes = await request(app).post('/revisions').set('x-api-key', 'test-write-key').send({ deviceId: deviceRes.body.id, version: '1.0.0' });
    expect(revRes.status).toBe(201);
    revisionId = revRes.body.id;
  });

  it('imports bom and calculates cost', async () => {
    const importRes = await request(app).post(`/revisions/${revisionId}/bom/import`).set('x-api-key', 'test-write-key').send({
      items: [
        { partName: 'PCB', quantity: 2, unitCost: 10, category: 'electronics' },
        { partName: 'Case', quantity: 1, unitCost: 20, category: 'mechanical' }
      ]
    });
    expect(importRes.status).toBe(201);

    const costRes = await request(app).get(`/revisions/${revisionId}/cost`);
    expect(costRes.status).toBe(200);
    expect(costRes.body.totalCost).toBe(43);
  });

  it('queues and runs autopilot search job', async () => {
    const queued = await request(app).post('/autopilot/search/jobs').set('x-api-key', 'test-write-key').send({ revisionId, type: 'price', mpn: 'ABC-1' });
    expect(queued.status).toBe(202);

    const run = await request(app).post(`/autopilot/search/jobs/${queued.body.id}/run`).set('x-api-key', 'test-write-key').send({ mockPrice: 3.33 });
    expect(run.status).toBe(200);
    expect(run.body.status).toBe('done');
    expect(run.body.result.price).toBe(3.33);
  });

  it('enforces write auth and exposes health/readiness', async () => {
    const unauthorized = await request(app).post('/devices').send({ name: 'Blocked' });
    expect(unauthorized.status).toBe(401);

    const health = await request(app).get('/healthz');
    expect(health.status).toBe(200);

    const ready = await request(app).get('/readyz');
    expect(ready.status).toBe(200);
  });

  it('enforces role-based access for policy and audit logs', async () => {
    const forbiddenPolicy = await request(app)
      .patch('/autopilot/search/policy')
      .set('x-api-key', 'test-write-key')
      .set('x-test-role', 'engineer')
      .send({ cacheTtlMinutes: 180 });
    expect(forbiddenPolicy.status).toBe(403);

    const allowedPolicy = await request(app)
      .patch('/autopilot/search/policy')
      .set('x-api-key', 'test-write-key')
      .set('x-test-role', 'manager')
      .send({ cacheTtlMinutes: 180 });
    expect(allowedPolicy.status).toBe(200);

    const forbiddenAudit = await request(app).get('/audit-logs').set('x-test-role', 'engineer');
    expect(forbiddenAudit.status).toBe(403);

    const allowedAudit = await request(app).get('/audit-logs').set('x-test-role', 'admin');
    expect(allowedAudit.status).toBe(200);
    expect(Array.isArray(allowedAudit.body)).toBe(true);
  });

  it('deduplicates webhook events by event key', async () => {
    const payload = { deviceId: revisionId, version: '1.0.1', project: { id: 1 }, after: 'abc' };
    const first = await request(app)
      .post('/webhooks/gitlab')
      .set('x-api-key', 'test-write-key')
      .set('x-gitlab-event', 'Push Hook')
      .set('x-gitlab-event-uuid', 'evt-1')
      .send(payload);
    expect(first.status).toBe(202);
    expect(first.body.deduplicated).toBeUndefined();

    const second = await request(app)
      .post('/webhooks/gitlab')
      .set('x-api-key', 'test-write-key')
      .set('x-gitlab-event', 'Push Hook')
      .set('x-gitlab-event-uuid', 'evt-1')
      .send(payload);
    expect(second.status).toBe(202);
    expect(second.body.deduplicated).toBe(true);
  });
});
