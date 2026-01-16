'use client';

import { NodeViewWrapper } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { MathfieldElement } from 'mathlive';
import React from 'react';

export function InlineMathNodeView({ node, updateAttributes }: any) {
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
    <NodeViewWrapper className="inline-block my-1">
      <span className="inline-block bg-white rounded border-2 border-gray-200 hover:border-blue-400 focus-within:border-blue-500 transition-colors px-2 py-1 touch-manipulation">
        {mathLiveLoaded ? (
          React.createElement('math-field', {
            ref: mathfieldRef,
            className: "inline-block text-lg outline-none",
            style: {
              display: 'inline-block',
              minWidth: '100px',
              border: 'none',
              touchAction: 'manipulation',
            },
          })
        ) : (
          <span className="text-gray-400 text-sm">Loading...</span>
        )}
      </span>
    </NodeViewWrapper>
  );
}
