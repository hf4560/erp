import express from 'express';
import { v4 as uuid } from 'uuid';

type RevisionStatus = 'draft' | 'review' | 'released';
type SubsystemType = 'electronics' | 'mechanical' | 'firmware';
type TaskStatus = 'todo' | 'in_progress' | 'done';
type TaskType = 'cost_reduction' | 'bug' | 'design' | 'optimization';

type Device = { id: string; name: string; description?: string; createdAt: string; updatedAt: string };
type Revision = { id: string; deviceId: string; version: string; status: RevisionStatus; createdAt: string };
type BomItem = { id: string; revisionId: string; partName: string; manufacturer?: string; mpn?: string; quantity: number; unitCost: number; totalCost: number; category: SubsystemType };
type Task = { id: string; revisionId: string; title: string; description?: string; status: TaskStatus; assigneeId?: string; type: TaskType };
type AutopilotMode = 'manual' | 'assisted-autopilot' | 'full-autopilot';
type SearchType = 'price' | 'datasheet' | 'substitution';
type SearchJobStatus = 'queued' | 'running' | 'done' | 'failed';
type SearchPolicy = {
  mode: AutopilotMode;
  whitelistDomains: string[];
  blacklistDomains: string[];
  cacheTtlMinutes: number;
  confidenceThreshold: number;
  highImpactDeltaPercent: number;
};
type SearchJob = {
  id: string;
  revisionId: string;
  type: SearchType;
  mpn?: string;
  manufacturer?: string;
  currency?: string;
  region?: string;
  status: SearchJobStatus;
  requestedAt: string;
  result?: {
    source: string;
    confidence: number;
    price?: number;
    currency?: string;
    note: string;
  };
};

const app = express();
app.use(express.json());

const devices: Device[] = [];
const revisions: Revision[] = [];
const bomItems: BomItem[] = [];
const tasks: Task[] = [];
const searchJobs: SearchJob[] = [];
const searchPolicy: SearchPolicy = {
  mode: 'manual',
  whitelistDomains: ['octopart.com', 'digikey.com', 'mouser.com'],
  blacklistDomains: [],
  cacheTtlMinutes: 120,
  confidenceThreshold: 0.8,
  highImpactDeltaPercent: 7
};

app.get('/devices', (_req, res) => res.json(devices));
app.post('/devices', (req, res) => {
  const now = new Date().toISOString();
  const device: Device = { id: uuid(), name: req.body.name, description: req.body.description, createdAt: now, updatedAt: now };
  devices.push(device);
  res.status(201).json(device);
});
app.get('/devices/:id', (req, res) => res.json(devices.find((d) => d.id === req.params.id) ?? null));

app.get('/devices/:id/revisions', (req, res) => res.json(revisions.filter((r) => r.deviceId === req.params.id)));
app.post('/revisions', (req, res) => {
  const revision: Revision = { id: uuid(), deviceId: req.body.deviceId, version: req.body.version, status: req.body.status ?? 'draft', createdAt: new Date().toISOString() };
  revisions.push(revision);
  res.status(201).json(revision);
});

app.get('/revisions/:id/bom', (req, res) => res.json(bomItems.filter((b) => b.revisionId === req.params.id)));
app.post('/revisions/:id/bom/import', (req, res) => {
  const imported: BomItem[] = (req.body.items ?? []).map((item: Omit<BomItem, 'id' | 'revisionId' | 'totalCost'>) => ({
    ...item,
    id: uuid(),
    revisionId: req.params.id,
    totalCost: item.quantity * item.unitCost
  }));
  bomItems.push(...imported);
  res.status(201).json(imported);
});

app.get('/revisions/:id/tasks', (req, res) => res.json(tasks.filter((t) => t.revisionId === req.params.id)));
app.post('/tasks', (req, res) => {
  const task: Task = { id: uuid(), ...req.body, status: req.body.status ?? 'todo' };
  tasks.push(task);
  res.status(201).json(task);
});
app.patch('/tasks/:id', (req, res) => {
  const task = tasks.find((t) => t.id === req.params.id);
  if (!task) return res.status(404).json({ message: 'Task not found' });
  Object.assign(task, req.body);
  return res.json(task);
});

app.get('/revisions/:id/cost', (req, res) => {
  const items = bomItems.filter((b) => b.revisionId === req.params.id);
  const breakdownMap = new Map<SubsystemType, number>([['electronics', 0], ['mechanical', 0], ['firmware', 0]]);

  for (const item of items) {
    const base = item.quantity * item.unitCost;
    const adjusted = item.category === 'mechanical' ? base * 1.15 : item.category === 'firmware' ? 0 : base;
    breakdownMap.set(item.category, (breakdownMap.get(item.category) ?? 0) + adjusted);
  }

  const breakdown = Array.from(breakdownMap.entries()).map(([category, cost]) => ({ category, cost }));
  const totalCost = breakdown.reduce((sum, row) => sum + row.cost, 0);

  res.json({ revisionId: req.params.id, totalCost, breakdown });
});

app.post('/integrations/gitlab/connect', (req, res) => res.json({ connected: true, project: req.body.project }));
app.post('/webhooks/gitlab', (req, res) => {
  const event = req.header('x-gitlab-event') ?? 'unknown';
  if (event.includes('Push') || event.includes('Tag Push')) {
    const revision: Revision = { id: uuid(), deviceId: req.body.deviceId, version: req.body.version ?? 'auto', status: 'draft', createdAt: new Date().toISOString() };
    revisions.push(revision);
  }
  res.status(202).json({ received: true, event });
});

app.get('/autopilot/search/policy', (_req, res) => {
  res.json(searchPolicy);
});

app.patch('/autopilot/search/policy', (req, res) => {
  Object.assign(searchPolicy, req.body);
  res.json(searchPolicy);
});

app.get('/autopilot/search/jobs', (_req, res) => {
  res.json(searchJobs);
});

app.post('/autopilot/search/jobs', (req, res) => {
  const job: SearchJob = {
    id: uuid(),
    revisionId: req.body.revisionId,
    type: req.body.type,
    mpn: req.body.mpn,
    manufacturer: req.body.manufacturer,
    currency: req.body.currency,
    region: req.body.region,
    status: 'queued',
    requestedAt: new Date().toISOString()
  };
  searchJobs.push(job);
  res.status(202).json(job);
});

app.post('/autopilot/search/jobs/:id/run', (req, res) => {
  const job = searchJobs.find((entry) => entry.id === req.params.id);
  if (!job) return res.status(404).json({ message: 'Search job not found' });

  job.status = 'running';
  const confidence = 0.86;
  job.result = {
    source: 'mock-source',
    confidence,
    price: req.body.mockPrice ?? 1.25,
    currency: req.body.currency ?? 'USD',
    note: confidence >= searchPolicy.confidenceThreshold ? 'Auto-candidate accepted for review queue' : 'Candidate requires manual review'
  };
  job.status = 'done';
  return res.json(job);
});

app.listen(3000, () => {
  console.log('ERP backend listening on :3000');
});
