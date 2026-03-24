import dynamic from 'next/dynamic';

const BoardPageInner = dynamic(() => import('./BoardPageInner'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-pulse text-muted-foreground">Loading whiteboard...</div>
    </div>
  ),
});

export default function BoardPage() {
  return <BoardPageInner />;
}
