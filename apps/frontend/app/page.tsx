import Link from 'next/link';

export default function HomePage() {
  return (
    <main>
      <h2>Dashboard</h2>
      <ul>
        <li><Link href="/devices">Devices</Link></li>
      </ul>
      <p>Use API-backed pages for devices, revisions, BOM and tasks.</p>
    </main>
  );
}
