'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface SymbolsSidebarProps {
  onInsertSymbol: (latex: string) => void;
  variables: Array<{ name: string; description: string }>;
}

// Symbol categories
const SYMBOL_CATEGORIES = {
  'Common': [
    { latex: '+', display: '+', label: 'Plus' },
    { latex: '-', display: '−', label: 'Minus' },
    { latex: '\\times', display: '×', label: 'Times' },
    { latex: '\\div', display: '÷', label: 'Divide' },
    { latex: '=', display: '=', label: 'Equals' },
    { latex: '\\neq', display: '≠', label: 'Not Equal' },
    { latex: '<', display: '<', label: 'Less Than' },
    { latex: '>', display: '>', label: 'Greater Than' },
    { latex: '\\leq', display: '≤', label: 'Less or Equal' },
    { latex: '\\geq', display: '≥', label: 'Greater or Equal' },
    { latex: '\\pm', display: '±', label: 'Plus Minus' },
    { latex: '\\approx', display: '≈', label: 'Approximately' },
  ],
  'Greek': [
    { latex: '\\alpha', display: 'α', label: 'Alpha' },
    { latex: '\\beta', display: 'β', label: 'Beta' },
    { latex: '\\gamma', display: 'γ', label: 'Gamma' },
    { latex: '\\delta', display: 'δ', label: 'Delta' },
    { latex: '\\epsilon', display: 'ε', label: 'Epsilon' },
    { latex: '\\theta', display: 'θ', label: 'Theta' },
    { latex: '\\lambda', display: 'λ', label: 'Lambda' },
    { latex: '\\mu', display: 'μ', label: 'Mu' },
    { latex: '\\pi', display: 'π', label: 'Pi' },
    { latex: '\\sigma', display: 'σ', label: 'Sigma' },
    { latex: '\\phi', display: 'φ', label: 'Phi' },
    { latex: '\\omega', display: 'ω', label: 'Omega' },
    { latex: '\\Gamma', display: 'Γ', label: 'Gamma (cap)' },
    { latex: '\\Delta', display: 'Δ', label: 'Delta (cap)' },
    { latex: '\\Theta', display: 'Θ', label: 'Theta (cap)' },
    { latex: '\\Sigma', display: 'Σ', label: 'Sigma (cap)' },
    { latex: '\\Omega', display: 'Ω', label: 'Omega (cap)' },
  ],
  'Calculus': [
    { latex: '\\int', display: '∫', label: 'Integral' },
    { latex: '\\int_{a}^{b}', display: '∫ₐᵇ', label: 'Definite Integral' },
    { latex: '\\sum_{i=1}^{n}', display: 'Σ', label: 'Summation' },
    { latex: '\\prod_{i=1}^{n}', display: 'Π', label: 'Product' },
    { latex: '\\lim_{x \\to a}', display: 'lim', label: 'Limit' },
    { latex: '\\frac{d}{dx}', display: 'd/dx', label: 'Derivative' },
    { latex: '\\partial', display: '∂', label: 'Partial' },
    { latex: '\\nabla', display: '∇', label: 'Nabla' },
    { latex: '\\infty', display: '∞', label: 'Infinity' },
  ],
  'Algebra': [
    { latex: '\\frac{a}{b}', display: 'a/b', label: 'Fraction' },
    { latex: 'x^{n}', display: 'xⁿ', label: 'Power' },
    { latex: 'x_{n}', display: 'xₙ', label: 'Subscript' },
    { latex: '\\sqrt{x}', display: '√x', label: 'Square Root' },
    { latex: '\\sqrt[n]{x}', display: 'ⁿ√x', label: 'Nth Root' },
    { latex: '|x|', display: '|x|', label: 'Absolute Value' },
    { latex: '\\log', display: 'log', label: 'Logarithm' },
    { latex: '\\ln', display: 'ln', label: 'Natural Log' },
    { latex: 'e^{x}', display: 'eˣ', label: 'Exponential' },
  ],
  'Trigonometry': [
    { latex: '\\sin', display: 'sin', label: 'Sine' },
    { latex: '\\cos', display: 'cos', label: 'Cosine' },
    { latex: '\\tan', display: 'tan', label: 'Tangent' },
    { latex: '\\cot', display: 'cot', label: 'Cotangent' },
    { latex: '\\sec', display: 'sec', label: 'Secant' },
    { latex: '\\csc', display: 'csc', label: 'Cosecant' },
    { latex: '\\arcsin', display: 'arcsin', label: 'Arcsine' },
    { latex: '\\arccos', display: 'arccos', label: 'Arccosine' },
    { latex: '\\arctan', display: 'arctan', label: 'Arctangent' },
  ],
  'Sets & Logic': [
    { latex: '\\in', display: '∈', label: 'Element Of' },
    { latex: '\\notin', display: '∉', label: 'Not Element Of' },
    { latex: '\\subset', display: '⊂', label: 'Subset' },
    { latex: '\\subseteq', display: '⊆', label: 'Subset or Equal' },
    { latex: '\\cup', display: '∪', label: 'Union' },
    { latex: '\\cap', display: '∩', label: 'Intersection' },
    { latex: '\\emptyset', display: '∅', label: 'Empty Set' },
    { latex: '\\forall', display: '∀', label: 'For All' },
    { latex: '\\exists', display: '∃', label: 'Exists' },
    { latex: '\\neg', display: '¬', label: 'Not' },
    { latex: '\\land', display: '∧', label: 'And' },
    { latex: '\\lor', display: '∨', label: 'Or' },
    { latex: '\\implies', display: '⟹', label: 'Implies' },
    { latex: '\\iff', display: '⟺', label: 'If and Only If' },
  ],
  'Arrows': [
    { latex: '\\rightarrow', display: '→', label: 'Right Arrow' },
    { latex: '\\leftarrow', display: '←', label: 'Left Arrow' },
    { latex: '\\leftrightarrow', display: '↔', label: 'Left-Right Arrow' },
    { latex: '\\Rightarrow', display: '⇒', label: 'Double Right Arrow' },
    { latex: '\\Leftarrow', display: '⇐', label: 'Double Left Arrow' },
    { latex: '\\Leftrightarrow', display: '⇔', label: 'Double Left-Right' },
    { latex: '\\mapsto', display: '↦', label: 'Maps To' },
  ],
  'Brackets': [
    { latex: '()', display: '( )', label: 'Parentheses' },
    { latex: '[]', display: '[ ]', label: 'Square Brackets' },
    { latex: '\\{\\}', display: '{ }', label: 'Curly Braces' },
    { latex: '\\langle \\rangle', display: '⟨ ⟩', label: 'Angle Brackets' },
    { latex: '\\lfloor \\rfloor', display: '⌊ ⌋', label: 'Floor' },
    { latex: '\\lceil \\rceil', display: '⌈ ⌉', label: 'Ceiling' },
  ],
};

export function SymbolsSidebar({ onInsertSymbol, variables }: SymbolsSidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Common']));
  const [searchQuery, setSearchQuery] = useState('');

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Filter symbols based on search
  const getFilteredSymbols = () => {
    if (!searchQuery) return SYMBOL_CATEGORIES;

    const filtered: Record<string, typeof SYMBOL_CATEGORIES['Common']> = {};
    const query = searchQuery.toLowerCase();

    for (const [category, symbols] of Object.entries(SYMBOL_CATEGORIES)) {
      const matches = symbols.filter(s =>
        s.label.toLowerCase().includes(query) ||
        s.latex.toLowerCase().includes(query) ||
        s.display.includes(query)
      );
      if (matches.length > 0) {
        filtered[category] = matches;
      }
    }

    return filtered;
  };

  const filteredCategories = getFilteredSymbols();

  return (
    <div className="w-72 border-l bg-gray-50 dark:bg-gray-900 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm mb-3">SYMBOLS PALETTE</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search symbols..."
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Variables section */}
      {variables.length > 0 && (
        <div className="p-4 border-b">
          <h4 className="text-xs font-medium text-gray-500 mb-2">OBJECTS</h4>
          <div className="space-y-1">
            {variables.slice(0, 6).map((v) => (
              <button
                key={v.name}
                onClick={() => onInsertSymbol(v.name)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-left"
              >
                <span className="text-blue-600 dark:text-blue-400 font-mono">{v.name}</span>
                <span className="text-xs text-gray-500 truncate">{v.description}</span>
              </button>
            ))}
            {variables.length > 6 && (
              <button className="text-xs text-blue-500 hover:underline px-2">
                See all {variables.length}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Symbol categories */}
      <div className="flex-1 overflow-y-auto p-2">
        {Object.entries(filteredCategories).map(([category, symbols]) => (
          <div key={category} className="mb-1">
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center gap-2 px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-left"
            >
              {expandedCategories.has(category) ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-sm font-medium">{category}</span>
            </button>

            {expandedCategories.has(category) && (
              <div className="grid grid-cols-4 gap-1 px-2 py-1">
                {symbols.map((symbol) => (
                  <Button
                    key={symbol.latex}
                    variant="ghost"
                    size="sm"
                    onClick={() => onInsertSymbol(symbol.latex)}
                    className="h-10 text-lg font-normal hover:bg-blue-50 dark:hover:bg-blue-950/30"
                    title={symbol.label}
                  >
                    {symbol.display}
                  </Button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Keyboard shortcuts */}
      <div className="p-4 border-t bg-gray-100 dark:bg-gray-800/50">
        <h4 className="text-xs font-medium text-gray-500 mb-2">SHORTCUTS</h4>
        <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex justify-between">
            <span>New math block</span>
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded text-[10px]">$</kbd>
          </div>
          <div className="flex justify-between">
            <span>New heading</span>
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded text-[10px]"># + space</kbd>
          </div>
          <div className="flex justify-between">
            <span>New line</span>
            <kbd className="px-1.5 py-0.5 bg-white dark:bg-gray-700 rounded text-[10px]">Enter</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
