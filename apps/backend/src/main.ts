import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createRemoteJWKSet, jwtVerify } from 'jose';

type RevisionStatus = 'draft' | 'review' | 'released';
type SubsystemType = 'electronics' | 'mechanical' | 'firmware';
type TaskStatus = 'todo' | 'in_progress' | 'done';
type TaskType = 'cost_reduction' | 'bug' | 'design' | 'optimization';
type SearchType = 'price' | 'datasheet' | 'substitution';
type UserRole = 'engineer' | 'cost_engineer' | 'manager' | 'admin';
type UserIdentity = { id: string; email: string; role: UserRole };

const prisma = new PrismaClient();
export const app = express();
app.use(express.json());
const writeApiKey = process.env.WRITE_API_KEY ?? 'dev-write-key';
const oidcIssuer = process.env.OIDC_ISSUER;
const oidcAudience = process.env.OIDC_AUDIENCE;
const jwksUrl = process.env.OIDC_JWKS_URL;
const jwks = jwksUrl ? createRemoteJWKSet(new URL(jwksUrl)) : null;
const maxWebhookRetries = Number(process.env.WEBHOOK_MAX_RETRIES ?? '5');

app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
app.get('/readyz', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ready' });
});

app.use((req, res, next) => {
  const isWrite = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method);
  if (!isWrite) return next();
  const apiKey = req.header('x-api-key');
  if (apiKey !== writeApiKey) return res.status(401).json({ message: 'Unauthorized write operation' });
  return next();
});

function getRole(req: express.Request): UserRole {
  const user = req.user as UserIdentity | undefined;
  if (!user?.role) throw new Error('Missing role claim');
  return user.role;
}

function requireRole(allowed: UserRole[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const role = getRole(req);
      if (!allowed.includes(role)) {
        return res.status(403).json({ message: `Forbidden for role ${role}` });
      }
      return next();
    } catch {
      return res.status(401).json({ message: 'Unauthorized user context' });
    }
  };
}

async function writeAuditLog(params: { actor?: string; action: string; entityType: string; entityId: string; payload?: unknown }): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actor: params.actor ?? 'system',
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      payload: params.payload as object | undefined
    }
  });
}

app.use(async (req, _res, next) => {
  if (process.env.NODE_ENV === 'test' && req.header('x-test-role')) {
    const role = req.header('x-test-role') as UserRole;
    req.user = { id: `test-${role}`, email: `${role}@test.local`, role };
    return next();
  }
  const auth = req.header('authorization');
  if (!auth?.startsWith('Bearer ')) return next();
  const token = auth.replace('Bearer ', '');
  try {
    if (!jwks || !oidcIssuer || !oidcAudience) throw new Error('OIDC not configured');
    const { payload } = await jwtVerify(token, jwks, { issuer: oidcIssuer, audience: oidcAudience });
    req.user = {
      id: String(payload.sub ?? ''),
      email: String(payload.email ?? ''),
      role: String(payload.role ?? '') as UserRole
    };
  } catch {
    req.user = undefined;
  }
  return next();
});

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
  await writeAuditLog({ actor: req.user?.email ?? 'api', action: 'create', entityType: 'device', entityId: device.id, payload: device });
  res.status(201).json(device);
});
app.get('/devices/:id', async (req, res) => res.json(await prisma.device.findUnique({ where: { id: req.params.id } })));
app.get('/devices/:id/revisions', async (req, res) => res.json(await prisma.revision.findMany({ where: { deviceId: req.params.id } })));
app.post('/revisions', async (req, res) => {
  const revision = await prisma.revision.create({ data: { deviceId: req.body.deviceId, version: req.body.version, status: (req.body.status ?? 'draft') as RevisionStatus } });
  await writeAuditLog({ actor: req.user?.email ?? 'api', action: 'create', entityType: 'revision', entityId: revision.id, payload: revision });
  res.status(201).json(revision);
});

app.get('/revisions/:id/bom', async (req, res) => res.json(await prisma.bomItem.findMany({ where: { revisionId: req.params.id } })));
app.post('/revisions/:id/bom/import', async (req, res) => {
  const imported = await prisma.$transaction(
    (req.body.items ?? []).map((item: { partName: string; manufacturer?: string; mpn?: string; quantity: number; unitCost: number; category: SubsystemType }) =>
      prisma.bomItem.create({ data: { revisionId: req.params.id, partName: item.partName, manufacturer: item.manufacturer, mpn: item.mpn, quantity: item.quantity, unitCost: item.unitCost, totalCost: item.quantity * item.unitCost, category: item.category } })
    )
  );
  await writeAuditLog({ actor: req.user?.email ?? 'api', action: 'import', entityType: 'bom', entityId: req.params.id, payload: { count: imported.length } });
  res.status(201).json(imported);
});

app.get('/revisions/:id/tasks', async (req, res) => res.json(await prisma.task.findMany({ where: { revisionId: req.params.id } })));
app.post('/tasks', async (req, res) => {
  const task = await prisma.task.create({ data: { revisionId: req.body.revisionId, title: req.body.title, description: req.body.description, status: (req.body.status ?? 'todo') as TaskStatus, assigneeId: req.body.assigneeId, type: req.body.type as TaskType } });
  await writeAuditLog({ actor: req.user?.email ?? 'api', action: 'create', entityType: 'task', entityId: task.id, payload: task });
  res.status(201).json(task);
});
app.patch('/tasks/:id', async (req, res) => {
  const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ message: 'Task not found' });
  const task = await prisma.task.update({ where: { id: req.params.id }, data: req.body });
  await writeAuditLog({ actor: req.user?.email ?? 'api', action: 'update', entityType: 'task', entityId: task.id, payload: req.body });
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
  const eventKey = req.header('x-gitlab-event-uuid') ?? `${event}:${req.body?.project?.id ?? 'na'}:${req.body?.after ?? 'na'}`;
  const existing = await prisma.webhookEvent.findUnique({ where: { eventKey } });
  if (existing) return res.status(202).json({ received: true, deduplicated: true, eventKey });

  await prisma.webhookEvent.create({
    data: {
      source: 'gitlab',
      eventKey,
      payload: req.body,
      status: 'received'
    }
  });
  try {
    if (event.includes('Push') || event.includes('Tag Push')) {
      const revision = await prisma.revision.create({ data: { deviceId: req.body.deviceId, version: req.body.version ?? 'auto', status: 'draft' } });
      await writeAuditLog({ actor: 'gitlab-webhook', action: 'auto-create', entityType: 'revision', entityId: revision.id, payload: { event } });
    }
    await prisma.webhookEvent.update({ where: { eventKey }, data: { status: 'processed' } });
  } catch (error) {
    const retryCount = 1;
    const nextRetryAt = new Date(Date.now() + 60_000);
    await prisma.webhookEvent.update({
      where: { eventKey },
      data: {
        status: 'failed',
        retryCount,
        nextRetryAt,
        lastError: String(error)
      }
    });
    return res.status(202).json({ received: true, event, eventKey, status: 'failed', retryCount, nextRetryAt });
  }
  res.status(202).json({ received: true, event, eventKey });
});

app.post('/internal/webhooks/retry-tick', requireRole(['admin']), async (_req, res) => {
  const now = new Date();
  const failedEvents = await prisma.webhookEvent.findMany({
    where: { status: 'failed', nextRetryAt: { lte: now }, retryCount: { lt: maxWebhookRetries } },
    orderBy: { createdAt: 'asc' },
    take: 50
  });
  let retried = 0;
  for (const event of failedEvents) {
    const nextRetryCount = event.retryCount + 1;
    try {
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: { status: 'processed', retryCount: nextRetryCount, nextRetryAt: null, lastError: null }
      });
      retried += 1;
    } catch (error) {
      const delayMs = Math.min(60_000 * nextRetryCount, 10 * 60_000);
      await prisma.webhookEvent.update({
        where: { id: event.id },
        data: {
          status: nextRetryCount >= maxWebhookRetries ? 'dead_letter' : 'failed',
          retryCount: nextRetryCount,
          nextRetryAt: new Date(Date.now() + delayMs),
          lastError: String(error)
        }
      });
    }
  }
  return res.json({ scanned: failedEvents.length, retried });
});

app.get('/autopilot/search/policy', async (_req, res) => {
  res.json(await prisma.searchPolicy.findUnique({ where: { id: 'default' } }));
});
app.patch('/autopilot/search/policy', requireRole(['cost_engineer', 'manager', 'admin']), async (req, res) => {
  const policy = await prisma.searchPolicy.update({ where: { id: 'default' }, data: req.body });
  await writeAuditLog({ actor: req.user?.email ?? 'api', action: 'update', entityType: 'search_policy', entityId: policy.id, payload: req.body });
  res.json(policy);
});

app.get('/autopilot/search/jobs', async (_req, res) => {
  res.json(await prisma.searchJob.findMany({ orderBy: { requestedAt: 'desc' } }));
});
app.post('/autopilot/search/jobs', async (req, res) => {
  const job = await prisma.searchJob.create({ data: { revisionId: req.body.revisionId, type: req.body.type as SearchType, mpn: req.body.mpn, manufacturer: req.body.manufacturer, currency: req.body.currency, region: req.body.region, status: 'queued' } });
  await writeAuditLog({ actor: req.user?.email ?? 'api', action: 'queue', entityType: 'search_job', entityId: job.id, payload: job });
  res.status(202).json(job);
});
app.post('/autopilot/search/jobs/:id/run', async (req, res) => {
  const job = await prisma.searchJob.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ message: 'Search job not found' });
  const policy = await prisma.searchPolicy.findUniqueOrThrow({ where: { id: 'default' } });
  const confidence = 0.86;
  const updated = await prisma.searchJob.update({ where: { id: req.params.id }, data: { status: 'done', result: { source: 'mock-source', confidence, price: req.body.mockPrice ?? 1.25, currency: req.body.currency ?? 'USD', note: confidence >= policy.confidenceThreshold ? 'Auto-candidate accepted for review queue' : 'Candidate requires manual review' } } });
  await writeAuditLog({ actor: req.user?.email ?? 'api', action: 'run', entityType: 'search_job', entityId: updated.id, payload: updated.result });
  return res.json(updated);
});

app.get('/audit-logs', requireRole(['manager', 'admin']), async (_req, res) => {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
  res.json(logs);
});
app.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
  res.json({ role: req.user.role, email: req.user.email });
});

if (process.env.NODE_ENV !== 'test') {
  if (!oidcIssuer || !oidcAudience || !jwksUrl) {
    throw new Error('OIDC_ISSUER, OIDC_AUDIENCE and OIDC_JWKS_URL must be configured');
  }
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
