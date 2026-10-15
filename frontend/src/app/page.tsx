'use client';

import dynamic from 'next/dynamic';

const DashboardClient = dynamic(() => import('@/components/DashboardView'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-500 text-sm">
      Caricamento interfaccia...
    </div>
  ),
});

export default function Page() {
  return <DashboardClient />;
}