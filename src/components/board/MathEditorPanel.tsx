'use client';

import React, { useState, useRef, useEffect } from 'react';
import { MathfieldElement } from 'mathlive';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { X, Check, Type, Sigma } from 'lucide-react';
import { LatexRenderer } from '@/components/chat/LatexRenderer';

interface MathEditorPanelProps {
  open: boolean;
  onInsert: (latex: string) => void;
  onClose: () => void;
  initialLatex?: string; // For editing existing equations
}

export function MathEditorPanel({ open, onInsert, onClose, initialLatex = '' }: MathEditorPanelProps) {
  const [latex, setLatex] = useState(initialLatex);
  const [showLatexInput, setShowLatexInput] = useState(false);
  const mathfieldRef = useRef<MathfieldElement | null>(null);

  useEffect(() => {
    if (open && mathfieldRef.current) {
      // Initialize MathLive
      import('mathlive').then(() => {
        const mf = mathfieldRef.current;
        if (mf) {
          mf.value = latex;
          mf.addEventListener('input', (evt) => {
            setLatex((evt.target as MathfieldElement).value);
          });
        }
      });
    }
  }, [open, latex]);

  // Update latex when initialLatex changes (for editing mode)
  useEffect(() => {
    setLatex(initialLatex);
    if (mathfieldRef.current && initialLatex) {
      mathfieldRef.current.value = initialLatex;
    }
  }, [initialLatex]);

  const handleInsert = () => {
    if (latex.trim()) {
      onInsert(latex);
      setLatex('');
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-full max-w-md">
      <Card className="shadow-2xl border-2">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sigma className="h-4 w-4" />
            Math Editor
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
            <X className="h-3 w-3" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-3 pt-3">
          {/* WYSIWYG Editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium">Equation</label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowLatexInput(!showLatexInput)}
                className="h-7 text-xs"
              >
                <Type className="h-3 w-3 mr-1" />
                {showLatexInput ? 'Hide' : 'Show'} LaTeX
              </Button>
            </div>

            {/* @ts-ignore - math-field is a custom element from MathLive */}
            {React.createElement('math-field', {
              ref: mathfieldRef,
              className: "border rounded-lg p-3 w-full text-xl",
              style: {
                minHeight: '80px',
              },
            }, latex)}
          </div>

          {/* LaTeX Source Input (optional) */}
          {showLatexInput && (
            <div>
              <label className="text-xs font-medium">LaTeX Source</label>
              <Textarea
                value={latex}
                onChange={(e) => {
                  setLatex(e.target.value);
                  if (mathfieldRef.current) {
                    mathfieldRef.current.value = e.target.value;
                  }
                }}
                placeholder="e.g., \\frac{x^2 + 1}{2}"
                className="font-mono text-xs mt-1.5"
                rows={2}
              />
            </div>
          )}

          {/* Live Preview */}
          <div>
            <label className="text-xs font-medium">Preview</label>
            <div className="border rounded-lg p-3 bg-muted/30 min-h-[60px] flex items-center justify-center">
              {latex ? (
                <LatexRenderer content={`$$${latex}$$`} />
              ) : (
                <span className="text-muted-foreground text-xs">
                  Start typing to see preview...
                </span>
              )}
            </div>
          </div>

          {/* Quick Symbols */}
          <div>
            <label className="text-xs font-medium mb-1.5 block">Quick Symbols</label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SYMBOLS.map((symbol) => (
                <Button
                  key={symbol.latex}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (mathfieldRef.current) {
                      mathfieldRef.current.executeCommand(['insert', symbol.latex]);
                    }
                  }}
                  className="font-mono h-7 px-2 text-xs"
                >
                  {symbol.display}
                </Button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="h-8 text-xs">
              Cancel
            </Button>
            <Button onClick={handleInsert} disabled={!latex.trim()} className="h-8 text-xs">
              <Check className="h-3 w-3 mr-1.5" />
              Insert
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Common math symbols for quick insertion
const QUICK_SYMBOLS = [
  { latex: '\\frac{#@}{#?}', display: 'x/y' },
  { latex: '#@^{#?}', display: 'x²' },
  { latex: '\\sqrt{#0}', display: '√' },
  { latex: '\\int_{#?}^{#?}', display: '∫' },
  { latex: '\\sum_{#?}^{#?}', display: '∑' },
  { latex: '\\lim_{#?}', display: 'lim' },
  { latex: '\\alpha', display: 'α' },
  { latex: '\\beta', display: 'β' },
  { latex: '\\theta', display: 'θ' },
  { latex: '\\pi', display: 'π' },
  { latex: '\\infty', display: '∞' },
  { latex: '\\leq', display: '≤' },
  { latex: '\\geq', display: '≥' },
  { latex: '\\neq', display: '≠' },
];
