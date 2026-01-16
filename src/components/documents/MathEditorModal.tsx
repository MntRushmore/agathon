'use client';

import { useState, useRef, useEffect } from 'react';
import { MathfieldElement } from 'mathlive';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { LatexRenderer } from '@/components/chat/LatexRenderer';
import React from 'react';

interface MathEditorModalProps {
  initialLatex: string;
  onSave: (latex: string) => void;
  onClose: () => void;
}

export function MathEditorModal({ initialLatex, onSave, onClose }: MathEditorModalProps) {
  const [latex, setLatex] = useState(initialLatex);
  const [mathLiveLoaded, setMathLiveLoaded] = useState(false);
  const mathfieldRef = useRef<MathfieldElement | null>(null);

  useEffect(() => {
    // Dynamically import and initialize MathLive
    import('mathlive').then((MathLive) => {
      setMathLiveLoaded(true);

      // Wait for next tick to ensure the element is in the DOM
      setTimeout(() => {
        const mf = mathfieldRef.current;
        if (mf) {
          console.log('Initializing MathLive field with latex:', latex);
          mf.value = latex || '';

          const handleInput = (evt: Event) => {
            const newLatex = (evt.target as MathfieldElement).value;
            console.log('Math input changed:', newLatex);
            setLatex(newLatex);
          };

          mf.addEventListener('input', handleInput);

          // Focus the field
          mf.focus();

          return () => {
            mf.removeEventListener('input', handleInput);
          };
        }
      }, 100);
    });
  }, []);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Equation</DialogTitle>
          <DialogDescription>
            Enter your mathematical equation below
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* MathLive Editor */}
          <div>
            <label className="text-sm font-medium">Equation</label>
            {mathLiveLoaded ? (
              React.createElement('math-field', {
                ref: mathfieldRef,
                className: "border rounded-lg p-3 w-full text-xl mt-2",
                style: { minHeight: '80px', display: 'block' },
              })
            ) : (
              <div className="border rounded-lg p-3 w-full mt-2 min-h-[80px] flex items-center justify-center text-muted-foreground">
                Loading math editor...
              </div>
            )}
          </div>

          {/* Preview */}
          <div>
            <label className="text-sm font-medium">Preview</label>
            <div className="border rounded-lg p-4 bg-muted/30 min-h-[60px] flex items-center justify-center mt-2">
              {latex ? (
                <LatexRenderer content={`$$${latex}$$`} />
              ) : (
                <span className="text-muted-foreground text-sm">
                  Type your equation above
                </span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button onClick={() => onSave(latex)} disabled={!latex.trim()}>
              <Check className="h-4 w-4 mr-2" />
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
