'use client';

import React from 'react';
import { Tldraw } from 'tldraw';
import 'tldraw/tldraw.css';

interface InlineWhiteboardProps {
  id: string;
  initialData?: string;
  onSave?: (data: string) => void;
  height?: number;
}

export function InlineWhiteboard({ id, height = 400 }: InlineWhiteboardProps) {
  return (
    <div
      className="inline-whiteboard rounded-xl overflow-hidden border border-gray-200 my-4"
      style={{ height: `${height}px`, width: '100%' }}
    >
      <Tldraw
        hideUi={false}
        inferDarkMode={false}
      />
    </div>
  );
}
