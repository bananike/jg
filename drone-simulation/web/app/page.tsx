'use client';

import dynamic from 'next/dynamic';
import SidePanel from '@/components/SidePanel';

const MapClient = dynamic(() => import('@/components/MapClient'), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 text-neutral-400">
      지도 로딩중...
    </div>
  ),
});

export default function Page() {
  return (
    <div className="flex h-full bg-neutral-950">
      <main className="relative flex-1 overflow-hidden">
        <MapClient />
      </main>
      <SidePanel />
    </div>
  );
}
