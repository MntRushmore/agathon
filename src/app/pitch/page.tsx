'use client';

import { Logo } from '@/components/ui/logo';

export default function PitchPage() {
  // Convert Canva view URL to embed URL
  const canvaEmbedUrl = 'https://www.canva.com/design/DAG_dLdTLgM/UHCwyamon0eeD3P2nXuhmw/view?embed';

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-black/80 backdrop-blur-sm border-b border-white/10">
        <Logo size="md" showText className="text-white" />
        <a
          href="/"
          className="px-4 py-2 text-sm font-medium text-white bg-white/10 rounded-full hover:bg-white/20 transition-colors"
        >
          Try Agathon
        </a>
      </div>

      {/* Canva Embed - Full Screen */}
      <div className="flex-1 relative">
        <iframe
          src={canvaEmbedUrl}
          className="absolute inset-0 w-full h-full"
          allowFullScreen
          allow="fullscreen"
          style={{ border: 'none' }}
          title="Agathon Pitch Deck"
        />
      </div>
    </div>
  );
}
