'use client';

import { NodeViewWrapper } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { MathfieldElement } from 'mathlive';
import React from 'react';

export function BlockMathNodeView({ node, updateAttributes }: any) {
  const mathfieldRef = useRef<MathfieldElement | null>(null);
  const [mathLiveLoaded, setMathLiveLoaded] = useState(false);

  useEffect(() => {
    // Load MathLive
    import('mathlive').then(() => {
      setMathLiveLoaded(true);

      setTimeout(() => {
        const mf = mathfieldRef.current;
        if (mf) {
          mf.value = node.attrs.latex || '';

          const handleInput = (evt: Event) => {
            const newLatex = (evt.target as MathfieldElement).value;
            updateAttributes({ latex: newLatex });
          };

          mf.addEventListener('input', handleInput);

          // Auto-focus on mount if empty
          if (!node.attrs.latex) {
            mf.focus();
          }

          return () => {
            mf.removeEventListener('input', handleInput);
          };
        }
      }, 50);
    });
  }, [mathLiveLoaded]);

  return (
    <NodeViewWrapper className="block my-3">
      <div className="w-full bg-white rounded-lg border-2 border-gray-200 hover:border-blue-400 focus-within:border-blue-500 transition-colors p-3 touch-manipulation">
        {mathLiveLoaded ? (
          React.createElement('math-field', {
            ref: mathfieldRef,
            className: "w-full text-2xl outline-none",
            style: {
              display: 'block',
              minHeight: '60px',
              width: '100%',
              border: 'none',
              padding: '8px',
              touchAction: 'manipulation',
            },
          })
        ) : (
          <div className="w-full min-h-[60px] flex items-center justify-center text-gray-400">
            Loading...
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}
