import Link from 'next/link';
import { apiGet } from '../../lib/api';

type Device = { id: string; name: string; description?: string };

export default async function DevicesPage() {
  const devices = await apiGet<Device[]>('/devices');

  return (
    <main>
      <h2>Devices</h2>
      <ul>
        {devices.map((device) => (
          <li key={device.id}>
            <Link href={`/devices/${device.id}`}>{device.name}</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
