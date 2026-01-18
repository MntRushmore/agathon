'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Type,
  Sigma,
  Brackets,
  Grid3X3,
  Search,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Code,
  Pencil,
  Superscript,
  Subscript,
  Braces,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Variable {
  symbol: string;
  description: string;
  color?: string;
}

interface CorcaSidebarProps {
  onInsertSymbol: (latex: string) => void;
  variables: Variable[];
  activeTab?: 'function' | 'text';
}

// Symbol categories matching Corca's style
const FUNCTION_SYMBOLS = {
  'Greek Letters': [
    { latex: '\\alpha', display: 'α' },
    { latex: '\\beta', display: 'β' },
    { latex: '\\gamma', display: 'γ' },
    { latex: '\\delta', display: 'δ' },
    { latex: '\\epsilon', display: 'ε' },
    { latex: '\\zeta', display: 'ζ' },
    { latex: '\\eta', display: 'η' },
    { latex: '\\theta', display: 'θ' },
    { latex: '\\lambda', display: 'λ' },
    { latex: '\\mu', display: 'μ' },
    { latex: '\\pi', display: 'π' },
    { latex: '\\sigma', display: 'σ' },
    { latex: '\\phi', display: 'φ' },
    { latex: '\\omega', display: 'ω' },
    { latex: '\\Gamma', display: 'Γ' },
    { latex: '\\Delta', display: 'Δ' },
    { latex: '\\Theta', display: 'Θ' },
    { latex: '\\Lambda', display: 'Λ' },
    { latex: '\\Sigma', display: 'Σ' },
    { latex: '\\Omega', display: 'Ω' },
  ],
  'Operators': [
    { latex: '+', display: '+' },
    { latex: '-', display: '−' },
    { latex: '\\times', display: '×' },
    { latex: '\\div', display: '÷' },
    { latex: '\\cdot', display: '·' },
    { latex: '\\pm', display: '±' },
    { latex: '=', display: '=' },
    { latex: '\\neq', display: '≠' },
    { latex: '\\approx', display: '≈' },
    { latex: '<', display: '<' },
    { latex: '>', display: '>' },
    { latex: '\\leq', display: '≤' },
    { latex: '\\geq', display: '≥' },
  ],
  'Calculus': [
    { latex: '\\int', display: '∫' },
    { latex: '\\sum', display: 'Σ' },
    { latex: '\\prod', display: 'Π' },
    { latex: '\\partial', display: '∂' },
    { latex: '\\nabla', display: '∇' },
    { latex: '\\infty', display: '∞' },
    { latex: '\\lim', display: 'lim' },
  ],
  'Sets & Logic': [
    { latex: '\\in', display: '∈' },
    { latex: '\\notin', display: '∉' },
    { latex: '\\subset', display: '⊂' },
    { latex: '\\cup', display: '∪' },
    { latex: '\\cap', display: '∩' },
    { latex: '\\emptyset', display: '∅' },
    { latex: '\\forall', display: '∀' },
    { latex: '\\exists', display: '∃' },
    { latex: '\\land', display: '∧' },
    { latex: '\\lor', display: '∨' },
    { latex: '\\neg', display: '¬' },
  ],
  'Arrows': [
    { latex: '\\rightarrow', display: '→' },
    { latex: '\\leftarrow', display: '←' },
    { latex: '\\Rightarrow', display: '⇒' },
    { latex: '\\Leftarrow', display: '⇐' },
    { latex: '\\leftrightarrow', display: '↔' },
    { latex: '\\mapsto', display: '↦' },
  ],
};

const ARGUMENT_TEMPLATES = [
  { latex: '\\frac{\\partial f}{\\partial q_i}', display: '∂f/∂qᵢ' },
  { latex: '\\frac{\\partial f}{\\partial p_i}', display: '∂f/∂pᵢ' },
  { latex: '\\frac{\\partial g}{\\partial q_i}', display: '∂g/∂qᵢ' },
  { latex: '\\frac{\\partial g}{\\partial p_i}', display: '∂g/∂pᵢ' },
];

const PARENTHESES = [
  { latex: '()', display: '( )' },
  { latex: '[]', display: '[ ]' },
  { latex: '\\{\\}', display: '{ }' },
  { latex: '\\langle\\rangle', display: '⟨ ⟩' },
  { latex: '||', display: '| |' },
  { latex: '\\|\\|', display: '‖ ‖' },
];

export function CorcaSidebar({ onInsertSymbol, variables, activeTab = 'function' }: CorcaSidebarProps) {
  const [tab, setTab] = useState<'function' | 'text'>(activeTab);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['Greek Letters', 'OBJECTS']));
  const [showParentheses, setShowParentheses] = useState(true);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  return (
    <div className="w-72 border-l bg-white dark:bg-gray-950 flex flex-col h-full overflow-hidden">
      {/* Tab selector - Corca style icons */}
      <div className="flex items-center gap-1 p-2 border-b bg-gray-50 dark:bg-gray-900">
        <Button
          variant={tab === 'function' ? 'default' : 'ghost'}
          size="icon"
          className={cn(
            'h-9 w-9 rounded-lg',
            tab === 'function' && 'bg-blue-500 hover:bg-blue-600'
          )}
          onClick={() => setTab('function')}
        >
          <Sigma className="h-4 w-4" />
        </Button>
        <Button
          variant={tab === 'text' ? 'default' : 'ghost'}
          size="icon"
          className="h-9 w-9 rounded-lg"
          onClick={() => setTab('text')}
        >
          <Brackets className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg">
          <Grid3X3 className="h-4 w-4" />
        </Button>
      </div>

      {tab === 'function' ? (
        <div className="flex-1 overflow-y-auto">
          {/* Function section header */}
          <div className="p-3 border-b">
            <div className="flex items-center justify-between">
              <button
                onClick={() => toggleSection('FUNCTION')}
                className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-700"
              >
                {expandedSections.has('FUNCTION') ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                FUNCTION
              </button>
              <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">
                <Sigma className="h-3 w-3" />
                <span className="text-xs font-medium">Summation</span>
                <Button variant="ghost" size="icon" className="h-5 w-5 ml-1">
                  <Search className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Parameters */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">INDEX :</span>
                <div className="flex items-center gap-1">
                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 rounded font-mono text-sm">i</span>
                  <span>=</span>
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-sm">1</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">LABEL :</span>
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded font-mono text-sm">n</span>
              </div>
            </div>
          </div>

          {/* Argument templates */}
          <div className="p-3 border-b">
            <span className="text-xs font-semibold text-gray-500">ARGUMENT</span>
            <div className="grid grid-cols-4 gap-1 mt-2">
              {ARGUMENT_TEMPLATES.map((tmpl, i) => (
                <Button
                  key={i}
                  variant={i === 0 ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    'h-12 text-xs font-mono p-1',
                    i === 0 && 'bg-blue-500 hover:bg-blue-600'
                  )}
                  onClick={() => onInsertSymbol(tmpl.latex)}
                >
                  {tmpl.display}
                </Button>
              ))}
            </div>
          </div>

          {/* Parentheses */}
          <div className="p-3 border-b">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500">SHOW PARENTHESES</span>
              <button
                onClick={() => setShowParentheses(!showParentheses)}
                className={cn(
                  'w-10 h-5 rounded-full transition-colors',
                  showParentheses ? 'bg-blue-500' : 'bg-gray-300'
                )}
              >
                <div className={cn(
                  'w-4 h-4 bg-white rounded-full shadow transition-transform',
                  showParentheses ? 'translate-x-5' : 'translate-x-0.5'
                )} />
              </button>
            </div>
            <div className="flex gap-1 mt-2">
              {PARENTHESES.map((p, i) => (
                <Button
                  key={i}
                  variant={i === 0 ? 'default' : 'outline'}
                  size="sm"
                  className={cn(
                    'flex-1 h-9 font-mono',
                    i === 0 && 'bg-blue-500 hover:bg-blue-600'
                  )}
                  onClick={() => onInsertSymbol(p.latex)}
                >
                  {p.display}
                </Button>
              ))}
            </div>
          </div>

          {/* Variables/Objects */}
          <div className="p-3 border-b">
            <button
              onClick={() => toggleSection('OBJECTS')}
              className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-700 w-full"
            >
              {expandedSections.has('OBJECTS') ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              OBJECTS
            </button>

            {expandedSections.has('OBJECTS') && (
              <div className="mt-2 space-y-1">
                {variables.length > 0 ? variables.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => onInsertSymbol(v.symbol)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-left"
                  >
                    <span className="text-blue-500 dark:text-blue-400 font-semibold">{`>`}</span>
                    <span className={cn('font-semibold', v.color || 'text-blue-600 dark:text-blue-400')}>{v.symbol}</span>
                    <span className="text-xs text-gray-500 truncate">· {v.description}</span>
                  </button>
                )) : (
                  <div className="text-xs text-gray-400 py-2">No variables defined yet</div>
                )}
                {variables.length > 6 && (
                  <button className="text-xs text-blue-500 hover:underline w-full text-left px-2">
                    See all {variables.length}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Symbol categories */}
          <div className="p-3">
            <button
              onClick={() => toggleSection('SYMBOLS PALETTE')}
              className="flex items-center gap-2 text-xs font-semibold text-gray-500 hover:text-gray-700 w-full"
            >
              {expandedSections.has('SYMBOLS PALETTE') ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              SYMBOLS PALETTE
            </button>

            {expandedSections.has('SYMBOLS PALETTE') && (
              <div className="mt-2 space-y-3">
                {Object.entries(FUNCTION_SYMBOLS).map(([category, symbols]) => (
                  <div key={category}>
                    <span className="text-xs text-gray-400">{category}</span>
                    <div className="grid grid-cols-6 gap-1 mt-1">
                      {symbols.map((s, i) => (
                        <Button
                          key={i}
                          variant="ghost"
                          size="sm"
                          className="h-8 text-base hover:bg-blue-50 dark:hover:bg-blue-950"
                          onClick={() => onInsertSymbol(s.latex)}
                        >
                          {s.display}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Text formatting tab */
        <div className="flex-1 overflow-y-auto p-3">
          <div className="space-y-4">
            {/* Font size */}
            <div>
              <span className="text-xs font-semibold text-gray-500">TEXT SIZE</span>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-sm">16px</span>
                <div className="w-4 h-4 rounded-full bg-black dark:bg-white" />
              </div>
            </div>

            {/* Alignment */}
            <div>
              <span className="text-xs font-semibold text-gray-500">ALIGNMENT</span>
              <div className="flex gap-1 mt-2">
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <AlignLeft className="h-4 w-4" />
                </Button>
                <Button variant="default" size="icon" className="h-9 w-9 bg-blue-500">
                  <AlignCenter className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <AlignRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Formatting */}
            <div>
              <span className="text-xs font-semibold text-gray-500">FORMAT</span>
              <div className="flex gap-1 mt-2">
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <Bold className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <Italic className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <Code className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-9 w-9">
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Math shortcuts */}
            <div>
              <span className="text-xs font-semibold text-gray-500">MATH</span>
              <div className="flex gap-1 mt-2">
                <Button variant="outline" size="sm" className="flex-1 gap-1">
                  <Braces className="h-4 w-4" />
                  Group
                </Button>
                <Button variant="outline" size="sm" className="flex-1 gap-1">
                  <Superscript className="h-4 w-4" />
                  Exponent
                </Button>
                <Button variant="outline" size="sm" className="flex-1 gap-1">
                  <Subscript className="h-4 w-4" />
                  Subscript
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Helper at bottom */}
      <div className="border-t p-3 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border">
          <span className="text-lg">🤖</span>
          <span className="text-sm text-gray-500">Ask AI Helper anything...</span>
        </div>
      </div>
    </div>
  );
}
