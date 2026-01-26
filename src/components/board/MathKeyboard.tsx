'use client';

import { useState, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LatexRenderer } from '@/components/chat/LatexRenderer';

interface MathSymbol {
  display: string;
  latex: string;
  label?: string;
}

interface MathCategory {
  name: string;
  symbols: MathSymbol[];
}

const mathCategories: MathCategory[] = [
  {
    name: 'Basic',
    symbols: [
      { display: '+', latex: '+' },
      { display: '−', latex: '-' },
      { display: '×', latex: '\\times' },
      { display: '÷', latex: '\\div' },
      { display: '=', latex: '=' },
      { display: '≠', latex: '\\neq' },
      { display: '±', latex: '\\pm' },
      { display: '∓', latex: '\\mp' },
    ],
  },
  {
    name: 'Comparison',
    symbols: [
      { display: '<', latex: '<' },
      { display: '>', latex: '>' },
      { display: '≤', latex: '\\leq' },
      { display: '≥', latex: '\\geq' },
      { display: '≈', latex: '\\approx' },
      { display: '∼', latex: '\\sim' },
      { display: '≡', latex: '\\equiv' },
      { display: '∝', latex: '\\propto' },
    ],
  },
  {
    name: 'Fractions & Roots',
    symbols: [
      { display: '½', latex: '\\frac{a}{b}', label: 'a/b' },
      { display: '√', latex: '\\sqrt{x}', label: '√x' },
      { display: '∛', latex: '\\sqrt[3]{x}', label: '∛x' },
      { display: 'ⁿ√', latex: '\\sqrt[n]{x}', label: 'ⁿ√x' },
      { display: 'x²', latex: 'x^{2}', label: 'x²' },
      { display: 'xⁿ', latex: 'x^{n}', label: 'xⁿ' },
      { display: 'xₙ', latex: 'x_{n}', label: 'xₙ' },
      { display: 'aᵇc', latex: 'a^{b}_{c}', label: 'sup+sub' },
    ],
  },
  {
    name: 'Greek',
    symbols: [
      { display: 'α', latex: '\\alpha' },
      { display: 'β', latex: '\\beta' },
      { display: 'γ', latex: '\\gamma' },
      { display: 'δ', latex: '\\delta' },
      { display: 'θ', latex: '\\theta' },
      { display: 'λ', latex: '\\lambda' },
      { display: 'π', latex: '\\pi' },
      { display: 'σ', latex: '\\sigma' },
      { display: 'φ', latex: '\\phi' },
      { display: 'ω', latex: '\\omega' },
      { display: 'Δ', latex: '\\Delta' },
      { display: 'Σ', latex: '\\Sigma' },
    ],
  },
  {
    name: 'Calculus',
    symbols: [
      { display: '∫', latex: '\\int' },
      { display: '∬', latex: '\\iint' },
      { display: '∮', latex: '\\oint' },
      { display: '∂', latex: '\\partial' },
      { display: '∇', latex: '\\nabla' },
      { display: '∞', latex: '\\infty' },
      { display: 'lim', latex: '\\lim_{x \\to a}', label: 'limit' },
      { display: 'd/dx', latex: '\\frac{d}{dx}', label: 'derivative' },
    ],
  },
  {
    name: 'Sets & Logic',
    symbols: [
      { display: '∈', latex: '\\in' },
      { display: '∉', latex: '\\notin' },
      { display: '⊂', latex: '\\subset' },
      { display: '⊃', latex: '\\supset' },
      { display: '∪', latex: '\\cup' },
      { display: '∩', latex: '\\cap' },
      { display: '∅', latex: '\\emptyset' },
      { display: '∀', latex: '\\forall' },
      { display: '∃', latex: '\\exists' },
      { display: '¬', latex: '\\neg' },
      { display: '∧', latex: '\\land' },
      { display: '∨', latex: '\\lor' },
    ],
  },
  {
    name: 'Arrows',
    symbols: [
      { display: '→', latex: '\\rightarrow' },
      { display: '←', latex: '\\leftarrow' },
      { display: '↔', latex: '\\leftrightarrow' },
      { display: '⇒', latex: '\\Rightarrow' },
      { display: '⇐', latex: '\\Leftarrow' },
      { display: '⇔', latex: '\\Leftrightarrow' },
      { display: '↑', latex: '\\uparrow' },
      { display: '↓', latex: '\\downarrow' },
    ],
  },
  {
    name: 'Brackets',
    symbols: [
      { display: '( )', latex: '\\left( \\right)', label: '( )' },
      { display: '[ ]', latex: '\\left[ \\right]', label: '[ ]' },
      { display: '{ }', latex: '\\left\\{ \\right\\}', label: '{ }' },
      { display: '| |', latex: '\\left| \\right|', label: '| |' },
      { display: '⌊ ⌋', latex: '\\lfloor \\rfloor', label: 'floor' },
      { display: '⌈ ⌉', latex: '\\lceil \\rceil', label: 'ceil' },
    ],
  },
  {
    name: 'Functions',
    symbols: [
      { display: 'sin', latex: '\\sin' },
      { display: 'cos', latex: '\\cos' },
      { display: 'tan', latex: '\\tan' },
      { display: 'log', latex: '\\log' },
      { display: 'ln', latex: '\\ln' },
      { display: 'exp', latex: '\\exp' },
      { display: 'max', latex: '\\max' },
      { display: 'min', latex: '\\min' },
    ],
  },
];

interface MathKeyboardProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (latex: string) => void;
  position?: { x: number; y: number };
}

export function MathKeyboard({ isOpen, onClose, onInsert, position }: MathKeyboardProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [showPreview, setShowPreview] = useState(true);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSymbolClick = (symbol: MathSymbol) => {
    const latex = symbol.latex;
    setInputValue(prev => prev + latex);
    onInsert(latex);
  };

  const handleInsertExpression = () => {
    if (inputValue.trim()) {
      onInsert(`$${inputValue}$`);
      setInputValue('');
    }
  };

  return (
    <div
      className={cn(
        "fixed z-[1200] bg-white rounded-xl shadow-xl border border-gray-200",
        "w-[380px] max-w-[95vw] animate-in fade-in slide-in-from-bottom-2 duration-200"
      )}
      style={{
        left: position?.x ?? '50%',
        top: position?.y ?? '50%',
        transform: position ? 'none' : 'translate(-50%, -50%)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-700">Math Symbols</span>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* LaTeX Input with Preview */}
      <div className="px-3 py-2 border-b border-gray-100">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type LaTeX or click symbols..."
            className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-violet-500 focus:border-violet-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleInsertExpression();
              }
            }}
          />
          <button
            onClick={handleInsertExpression}
            disabled={!inputValue.trim()}
            className="px-3 py-1.5 text-sm font-medium text-white bg-violet-500 rounded-md hover:bg-violet-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Insert
          </button>
        </div>

        {/* Live Preview */}
        {inputValue && showPreview && (
          <div className="mt-2 p-2 bg-gray-50 rounded-md min-h-[40px] flex items-center justify-center">
            <div className="text-lg">
              <LatexRenderer content={`$${inputValue}$`} />
            </div>
          </div>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex overflow-x-auto border-b border-gray-100 px-1 py-1 gap-1 scrollbar-hide">
        {mathCategories.map((category, index) => (
          <button
            key={category.name}
            onClick={() => setActiveCategory(index)}
            className={cn(
              "px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors",
              activeCategory === index
                ? "bg-violet-100 text-violet-700"
                : "text-gray-500 hover:bg-gray-100"
            )}
          >
            {category.name}
          </button>
        ))}
      </div>

      {/* Symbol Grid */}
      <div className="p-2 max-h-[200px] overflow-y-auto">
        <div className="grid grid-cols-6 gap-1">
          {mathCategories[activeCategory].symbols.map((symbol, index) => (
            <button
              key={index}
              onClick={() => handleSymbolClick(symbol)}
              title={symbol.label || symbol.latex}
              className={cn(
                "h-10 flex items-center justify-center rounded-md border border-gray-100",
                "hover:bg-violet-50 hover:border-violet-200 transition-colors",
                "text-lg font-medium text-gray-700"
              )}
            >
              {symbol.display}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Templates */}
      <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 rounded-b-xl">
        <p className="text-xs text-gray-500 mb-1.5">Quick templates</p>
        <div className="flex flex-wrap gap-1">
          {[
            { label: 'Fraction', latex: '\\frac{}{} ' },
            { label: 'Square root', latex: '\\sqrt{} ' },
            { label: 'Power', latex: '^{} ' },
            { label: 'Subscript', latex: '_{} ' },
            { label: 'Sum', latex: '\\sum_{i=1}^{n} ' },
            { label: 'Integral', latex: '\\int_{a}^{b} ' },
          ].map((template) => (
            <button
              key={template.label}
              onClick={() => {
                setInputValue(prev => prev + template.latex);
                onInsert(template.latex);
              }}
              className="px-2 py-0.5 text-xs bg-white border border-gray-200 rounded hover:bg-violet-50 hover:border-violet-200 transition-colors"
            >
              {template.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
