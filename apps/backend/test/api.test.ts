import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';

const mod = await import('../src/main');
const app = mod.app;
const prisma = mod.prisma;
const ensureDefaultPolicy = mod.ensureDefaultPolicy;

describe('ERP API', () => {
  let revisionId = '';

  beforeAll(async () => {
    await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
    await ensureDefaultPolicy();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates device and revision', async () => {
    const deviceRes = await request(app).post('/devices').send({ name: 'Mic V2' });
    expect(deviceRes.status).toBe(201);

    const revRes = await request(app).post('/revisions').send({ deviceId: deviceRes.body.id, version: '1.0.0' });
    expect(revRes.status).toBe(201);
    revisionId = revRes.body.id;
  });

  it('imports bom and calculates cost', async () => {
    const importRes = await request(app).post(`/revisions/${revisionId}/bom/import`).send({
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
    const queued = await request(app).post('/autopilot/search/jobs').send({ revisionId, type: 'price', mpn: 'ABC-1' });
    expect(queued.status).toBe(202);

    const run = await request(app).post(`/autopilot/search/jobs/${queued.body.id}/run`).send({ mockPrice: 3.33 });
    expect(run.status).toBe(200);
    expect(run.body.status).toBe('done');
    expect(run.body.result.price).toBe(3.33);
  });
});
