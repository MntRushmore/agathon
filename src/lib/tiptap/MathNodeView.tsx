'use client';

import { NodeViewWrapper } from '@tiptap/react';
import { useState, useEffect } from 'react';
import { LatexRenderer } from '@/components/chat/LatexRenderer';
import { MathEditorModal } from '@/components/documents/MathEditorModal';

export function MathNodeView({ node, updateAttributes, deleteNode }: any) {
  const [editing, setEditing] = useState(!node.attrs.latex);
  const isBlock = node.type.name === 'mathBlock';

  useEffect(() => {
    console.log('MathNodeView rendered:', {
      type: node.type.name,
      latex: node.attrs.latex,
      editing
    });
  }, [node.type.name, node.attrs.latex, editing]);

  return (
    <NodeViewWrapper className={isBlock ? 'math-block' : 'math-inline'}>
      <div
        onClick={() => {
          console.log('Math node clicked, opening editor');
          setEditing(true);
        }}
        className="cursor-pointer hover:bg-accent/20 rounded px-1"
      >
        {node.attrs.latex ? (
          <LatexRenderer content={isBlock ? `$$${node.attrs.latex}$$` : `$${node.attrs.latex}$`} />
        ) : (
          <span className="text-muted-foreground">Click to add equation</span>
        )}
      </div>

      {editing && (
        <MathEditorModal
          initialLatex={node.attrs.latex}
          onSave={(latex) => {
            console.log('Saving latex:', latex);
            updateAttributes({ latex });
            setEditing(false);
          }}
          onClose={() => {
            console.log('Closing editor, deleting if empty');
            if (!node.attrs.latex) deleteNode();
            setEditing(false);
          }}
        />
      )}
    </NodeViewWrapper>
  );
}
