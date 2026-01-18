'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuickSymbolBarProps {
  onInsertSymbol: (latex: string) => void;
  disabled?: boolean;
}

// Common math symbols for quick insertion
const SYMBOLS = [
  // Basic operations
  { latex: '\\frac{#@}{#?}', display: 'a/b', label: 'Fraction' },
  { latex: '#@^{#?}', display: 'x\u00B2', label: 'Power' },
  { latex: '\\sqrt{#0}', display: '\u221A', label: 'Square root' },
  { latex: '\\sqrt[#?]{#0}', display: '\u221Bn', label: 'Nth root' },

  // Calculus
  { latex: '\\int_{#?}^{#?}#0\\,dx', display: '\u222B', label: 'Integral' },
  { latex: '\\sum_{#?}^{#?}', display: '\u03A3', label: 'Sum' },
  { latex: '\\prod_{#?}^{#?}', display: '\u03A0', label: 'Product' },
  { latex: '\\lim_{#? \\to #?}', display: 'lim', label: 'Limit' },
  { latex: '\\frac{d}{dx}', display: 'd/dx', label: 'Derivative' },

  // Greek letters
  { latex: '\\alpha', display: '\u03B1', label: 'Alpha' },
  { latex: '\\beta', display: '\u03B2', label: 'Beta' },
  { latex: '\\theta', display: '\u03B8', label: 'Theta' },
  { latex: '\\pi', display: '\u03C0', label: 'Pi' },
  { latex: '\\lambda', display: '\u03BB', label: 'Lambda' },
  { latex: '\\omega', display: '\u03C9', label: 'Omega' },

  // Comparisons
  { latex: '\\leq', display: '\u2264', label: 'Less than or equal' },
  { latex: '\\geq', display: '\u2265', label: 'Greater than or equal' },
  { latex: '\\neq', display: '\u2260', label: 'Not equal' },
  { latex: '\\approx', display: '\u2248', label: 'Approximately' },

  // Other
  { latex: '\\infty', display: '\u221E', label: 'Infinity' },
  { latex: '\\pm', display: '\u00B1', label: 'Plus minus' },
  { latex: '\\cdot', display: '\u00B7', label: 'Dot' },
  { latex: '\\times', display: '\u00D7', label: 'Times' },
];

export function QuickSymbolBar({ onInsertSymbol, disabled = false }: QuickSymbolBarProps) {
  return (
    <div className="border-t bg-gray-50 p-3">
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs font-medium text-gray-500 shrink-0 mr-1">Symbols:</span>
        <div className="flex gap-1 flex-wrap">
          {SYMBOLS.map((symbol) => (
            <Button
              key={symbol.latex}
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onInsertSymbol(symbol.latex)}
              className={cn(
                'h-8 px-2.5 text-base font-normal',
                'hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              title={symbol.label}
            >
              {symbol.display}
            </Button>
          ))}
        </div>
      </div>
      {disabled && (
        <p className="text-xs text-gray-400 mt-1">Click on an equation to insert symbols</p>
      )}
    </div>
  );
}
