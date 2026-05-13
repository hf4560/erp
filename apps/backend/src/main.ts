import express from 'express';
import { PrismaClient } from '@prisma/client';

type RevisionStatus = 'draft' | 'review' | 'released';
type SubsystemType = 'electronics' | 'mechanical' | 'firmware';
type TaskStatus = 'todo' | 'in_progress' | 'done';
type TaskType = 'cost_reduction' | 'bug' | 'design' | 'optimization';
type AutopilotMode = 'manual' | 'assisted-autopilot' | 'full-autopilot';
type SearchType = 'price' | 'datasheet' | 'substitution';

const prisma = new PrismaClient();
export const app = express();
app.use(express.json());

async function ensureDefaultPolicy(): Promise<void> {
  const row = await prisma.searchPolicy.findUnique({ where: { id: 'default' } });
  if (!row) {
    await prisma.searchPolicy.create({
      data: {
        id: 'default',
        mode: 'manual',
        whitelistDomains: ['octopart.com', 'digikey.com', 'mouser.com'],
        blacklistDomains: [],
        cacheTtlMinutes: 120,
        confidenceThreshold: 0.8,
        highImpactDeltaPercent: 7
      }
    });
  }
}

app.get('/devices', async (_req, res) => res.json(await prisma.device.findMany()));
app.post('/devices', async (req, res) => {
  const device = await prisma.device.create({ data: { name: req.body.name, description: req.body.description } });
  res.status(201).json(device);
});
app.get('/devices/:id', async (req, res) => res.json(await prisma.device.findUnique({ where: { id: req.params.id } })));

app.get('/devices/:id/revisions', async (req, res) => res.json(await prisma.revision.findMany({ where: { deviceId: req.params.id } })));
app.post('/revisions', async (req, res) => {
  const revision = await prisma.revision.create({
    data: { deviceId: req.body.deviceId, version: req.body.version, status: (req.body.status ?? 'draft') as RevisionStatus }
  });
  res.status(201).json(revision);
});

app.get('/revisions/:id/bom', async (req, res) => res.json(await prisma.bomItem.findMany({ where: { revisionId: req.params.id } })));
app.post('/revisions/:id/bom/import', async (req, res) => {
  const imported = await prisma.$transaction(
    (req.body.items ?? []).map((item: { partName: string; manufacturer?: string; mpn?: string; quantity: number; unitCost: number; category: SubsystemType }) =>
      prisma.bomItem.create({
        data: {
          revisionId: req.params.id,
          partName: item.partName,
          manufacturer: item.manufacturer,
          mpn: item.mpn,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.quantity * item.unitCost,
          category: item.category
        }
      })
    )
  );
  res.status(201).json(imported);
});

app.get('/revisions/:id/tasks', async (req, res) => res.json(await prisma.task.findMany({ where: { revisionId: req.params.id } })));
app.post('/tasks', async (req, res) => {
  const task = await prisma.task.create({
    data: {
      revisionId: req.body.revisionId,
      title: req.body.title,
      description: req.body.description,
      status: (req.body.status ?? 'todo') as TaskStatus,
      assigneeId: req.body.assigneeId,
      type: req.body.type as TaskType
    }
  });
  res.status(201).json(task);
});
app.patch('/tasks/:id', async (req, res) => {
  const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Task not found' });
  const task = await prisma.task.update({ where: { id: req.params.id }, data: req.body });
  return res.json(task);
});

app.get('/revisions/:id/cost', async (req, res) => {
  const items = await prisma.bomItem.findMany({ where: { revisionId: req.params.id } });
  const breakdownMap = new Map<SubsystemType, number>([['electronics', 0], ['mechanical', 0], ['firmware', 0]]);
  for (const item of items) {
    const base = item.quantity * item.unitCost;
    const adjusted = item.category === 'mechanical' ? base * 1.15 : item.category === 'firmware' ? 0 : base;
    breakdownMap.set(item.category as SubsystemType, (breakdownMap.get(item.category as SubsystemType) ?? 0) + adjusted);
  }
  const breakdown = Array.from(breakdownMap.entries()).map(([category, cost]) => ({ category, cost }));
  const totalCost = breakdown.reduce((sum, row) => sum + row.cost, 0);
  res.json({ revisionId: req.params.id, totalCost, breakdown });
});

app.post('/integrations/gitlab/connect', async (req, res) => res.json({ connected: true, project: req.body.project }));
app.post('/webhooks/gitlab', async (req, res) => {
  const event = req.header('x-gitlab-event') ?? 'unknown';
  if (event.includes('Push') || event.includes('Tag Push')) {
    await prisma.revision.create({
      data: { deviceId: req.body.deviceId, version: req.body.version ?? 'auto', status: 'draft' }
    });
  }
  res.status(202).json({ received: true, event });
});

app.get('/autopilot/search/policy', async (_req, res) => {
  res.json(await prisma.searchPolicy.findUnique({ where: { id: 'default' } }));
});

app.patch('/autopilot/search/policy', async (req, res) => {
  const policy = await prisma.searchPolicy.update({ where: { id: 'default' }, data: req.body });
  res.json(policy);
});

app.get('/autopilot/search/jobs', async (_req, res) => {
  res.json(await prisma.searchJob.findMany({ orderBy: { requestedAt: 'desc' } }));
});

app.post('/autopilot/search/jobs', async (req, res) => {
  const job = await prisma.searchJob.create({
    data: {
      revisionId: req.body.revisionId,
      type: req.body.type as SearchType,
      mpn: req.body.mpn,
      manufacturer: req.body.manufacturer,
      currency: req.body.currency,
      region: req.body.region,
      status: 'queued'
    }
  });
  res.status(202).json(job);
});

app.post('/autopilot/search/jobs/:id/run', async (req, res) => {
  const job = await prisma.searchJob.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ message: 'Search job not found' });

  const policy = await prisma.searchPolicy.findUniqueOrThrow({ where: { id: 'default' } });
  const confidence = 0.86;
  const updated = await prisma.searchJob.update({
    where: { id: req.params.id },
    data: {
      status: 'done',
      result: {
        source: 'mock-source',
        confidence,
        price: req.body.mockPrice ?? 1.25,
        currency: req.body.currency ?? 'USD',
        note: confidence >= policy.confidenceThreshold ? 'Auto-candidate accepted for review queue' : 'Candidate requires manual review'
      }
    }
  });
  return res.json(updated);
});

if (process.env.NODE_ENV !== 'test') {
  ensureDefaultPolicy().then(() => {
    app.listen(3000, () => {
      console.log('ERP backend listening on :3000');
    });
  }).catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}

export { ensureDefaultPolicy, prisma };
