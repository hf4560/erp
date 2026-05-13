import Link from 'next/link';
import { apiGet } from '../../../lib/api';

type Revision = { id: string; version: string; status: string };

type Props = { params: Promise<{ id: string }> };

export default async function DevicePage({ params }: Props) {
  const { id } = await params;
  const revisions = await apiGet<Revision[]>(`/devices/${id}/revisions`);

  return (
    <main>
      <h2>Device: {id}</h2>
      <h3>Revisions</h3>
      <ul>
        {revisions.map((revision) => (
          <li key={revision.id}>
            <Link href={`/devices/${id}/revisions/${revision.id}`}>
              {revision.version} ({revision.status})
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
