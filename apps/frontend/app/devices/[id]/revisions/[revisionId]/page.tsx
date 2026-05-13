import { apiGet } from '../../../../../lib/api';

type BomItem = { id: string; partName: string; quantity: number; unitCost: number; category: string };
type Task = { id: string; title: string; status: string; type: string };
type CostResponse = { totalCost: number; breakdown: Array<{ category: string; cost: number }> };

type Props = { params: Promise<{ id: string; revisionId: string }> };

export default async function RevisionPage({ params }: Props) {
  const { revisionId } = await params;
  const [bom, tasks, cost] = await Promise.all([
    apiGet<BomItem[]>(`/revisions/${revisionId}/bom`),
    apiGet<Task[]>(`/revisions/${revisionId}/tasks`),
    apiGet<CostResponse>(`/revisions/${revisionId}/cost`)
  ]);

  return (
    <main>
      <h2>Revision {revisionId}</h2>
      <h3>Cost</h3>
      <p>Total: {cost.totalCost.toFixed(2)}</p>
      <ul>
        {cost.breakdown.map((item) => <li key={item.category}>{item.category}: {item.cost.toFixed(2)}</li>)}
      </ul>

      <h3>BOM</h3>
      <ul>
        {bom.map((item) => <li key={item.id}>{item.partName} x{item.quantity} ({item.category})</li>)}
      </ul>

      <h3>Tasks</h3>
      <ul>
        {tasks.map((task) => <li key={task.id}>{task.title} [{task.status}]</li>)}
      </ul>
    </main>
  );
}
