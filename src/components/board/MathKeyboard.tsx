'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Undo2, Redo2, Clipboard, Delete, ChevronLeft, ChevronRight, CornerDownLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LatexRenderer } from '@/components/chat/LatexRenderer';

type LayoutType = 'numbers' | 'operators' | 'letters' | 'greek';

interface MathKeyboardProps {
  isOpen: boolean;
  onClose: () => void;
  onInsert: (latex: string) => void;
}

export function MathKeyboard({ isOpen, onClose, onInsert }: MathKeyboardProps) {
  const [inputValue, setInputValue] = useState('');
  const [activeLayout, setActiveLayout] = useState<LayoutType>('numbers');
  const [history, setHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [cursorPosition, setCursorPosition] = useState(0);

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

  const addToHistory = useCallback((value: string) => {
    setHistory(prev => [...prev.slice(0, historyIndex + 1), value]);
    setHistoryIndex(prev => prev + 1);
  }, [historyIndex]);

  const insertAtCursor = useCallback((text: string) => {
    const newValue = inputValue.slice(0, cursorPosition) + text + inputValue.slice(cursorPosition);
    setInputValue(newValue);
    setCursorPosition(cursorPosition + text.length);
    addToHistory(newValue);
  }, [inputValue, cursorPosition, addToHistory]);

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setInputValue(history[historyIndex - 1]);
    }
  }, [historyIndex, history]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setInputValue(history[historyIndex + 1]);
    }
  }, [historyIndex, history]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      insertAtCursor(text);
    } catch (err) {
      console.error('Failed to paste:', err);
    }
  }, [insertAtCursor]);

  const handleBackspace = useCallback(() => {
    if (cursorPosition > 0) {
      const newValue = inputValue.slice(0, cursorPosition - 1) + inputValue.slice(cursorPosition);
      setInputValue(newValue);
      setCursorPosition(prev => prev - 1);
      addToHistory(newValue);
    }
  }, [inputValue, cursorPosition, addToHistory]);

  const handleCursorLeft = useCallback(() => {
    setCursorPosition(prev => Math.max(0, prev - 1));
  }, []);

  const handleCursorRight = useCallback(() => {
    setCursorPosition(prev => Math.min(inputValue.length, prev + 1));
  }, [inputValue.length]);

  const handleInsert = useCallback(() => {
    if (inputValue.trim()) {
      // Pass raw LaTeX without $ delimiters - the toolbar will handle display
      onInsert(inputValue);
      setInputValue('');
      setCursorPosition(0);
      setHistory(['']);
      setHistoryIndex(0);
    }
  }, [inputValue, onInsert]);

  if (!isOpen) return null;

  const layouts = [
    { id: 'numbers' as const, label: '123' },
    { id: 'operators' as const, label: '∞≠∈' },
    { id: 'letters' as const, label: 'abc' },
    { id: 'greek' as const, label: 'αβγ' },
  ];

  // Number pad layout
  const numberKeys = [
    [
      { display: 'x', latex: 'x', superscript: 'y' },
      { display: 'n', latex: 'n', superscript: '' },
      { display: 'a', latex: 'a', superscript: '' },
    ],
    [
      { display: '<', latex: '<' },
      { display: '>', latex: '>' },
    ],
    [
      { display: '(', latex: '(' },
      { display: ')', latex: ')' },
    ],
  ];

  const numpad = [
    ['7', '8', '9', '÷'],
    ['4', '5', '6', '×'],
    ['1', '2', '3', '-'],
    ['0', '.', '=', '+'],
  ];

  const rightKeys = [
    [
      { display: 'e', latex: 'e', superscript: 'ln' },
      { display: 'i', latex: 'i', superscript: '' },
      { display: 'π', latex: '\\pi', superscript: 'sin' },
    ],
    [
      { display: '□²', latex: '^{2}', isTemplate: true },
      { display: '□ⁿ', latex: '^{}', isTemplate: true },
      { display: '√□', latex: '\\sqrt{}', isTemplate: true },
    ],
    [
      { display: '∫', latex: '\\int_{0}^{\\infty}', isTemplate: true },
      { display: '∀', latex: '\\forall' },
    ],
  ];

  // Operators layout
  const operatorKeys = [
    ['∞', '≠', '≈', '≤', '≥', '±'],
    ['∈', '∉', '⊂', '⊃', '∪', '∩'],
    ['∧', '∨', '¬', '→', '↔', '⇒'],
    ['∑', '∏', '∂', '∇', '∅', '∃'],
  ];

  // Letters layout
  const letterKeys = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
  ];

  // Greek layout
  const greekKeys = [
    ['α', 'β', 'γ', 'δ', 'ε', 'ζ', 'η', 'θ'],
    ['ι', 'κ', 'λ', 'μ', 'ν', 'ξ', 'ο', 'π'],
    ['ρ', 'σ', 'τ', 'υ', 'φ', 'χ', 'ψ', 'ω'],
    ['Γ', 'Δ', 'Θ', 'Λ', 'Ξ', 'Π', 'Σ', 'Φ', 'Ψ', 'Ω'],
  ];

  const greekLatexMap: Record<string, string> = {
    'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta',
    'ε': '\\epsilon', 'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta',
    'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu',
    'ν': '\\nu', 'ξ': '\\xi', 'ο': 'o', 'π': '\\pi',
    'ρ': '\\rho', 'σ': '\\sigma', 'τ': '\\tau', 'υ': '\\upsilon',
    'φ': '\\phi', 'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega',
    'Γ': '\\Gamma', 'Δ': '\\Delta', 'Θ': '\\Theta', 'Λ': '\\Lambda',
    'Ξ': '\\Xi', 'Π': '\\Pi', 'Σ': '\\Sigma', 'Φ': '\\Phi',
    'Ψ': '\\Psi', 'Ω': '\\Omega',
  };

  const operatorLatexMap: Record<string, string> = {
    '∞': '\\infty', '≠': '\\neq', '≈': '\\approx', '≤': '\\leq', '≥': '\\geq', '±': '\\pm',
    '∈': '\\in', '∉': '\\notin', '⊂': '\\subset', '⊃': '\\supset', '∪': '\\cup', '∩': '\\cap',
    '∧': '\\land', '∨': '\\lor', '¬': '\\neg', '→': '\\rightarrow', '↔': '\\leftrightarrow', '⇒': '\\Rightarrow',
    '∑': '\\sum', '∏': '\\prod', '∂': '\\partial', '∇': '\\nabla', '∅': '\\emptyset', '∃': '\\exists',
    '÷': '\\div', '×': '\\times',
  };

  const handleKeyPress = (key: string) => {
    const latex = greekLatexMap[key] || operatorLatexMap[key] || key;
    insertAtCursor(latex);
  };

  return (
    <div
      className={cn(
        "fixed z-[1200] bg-[#d1d3d9] rounded-xl shadow-2xl",
        "w-[520px] max-w-[95vw] animate-in fade-in slide-in-from-bottom-2 duration-200",
        "bottom-20 left-1/2 -translate-x-1/2"
      )}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Math Input Field */}
      <div className="bg-white m-2 rounded-lg p-3 flex items-center gap-2">
        <div className="flex-1 min-h-[40px] flex items-center justify-center text-xl">
          {inputValue ? (
            <LatexRenderer content={`$${inputValue}$`} />
          ) : (
            <span className="text-gray-400 text-base">Type or tap to enter math</span>
          )}
        </div>
        <button
          onClick={() => setInputValue('')}
          className="p-1.5 hover:bg-gray-100 rounded transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {/* Layout Tabs & Action Buttons */}
      <div className="flex items-center justify-between px-2 py-1.5">
        {/* Layout Selector */}
        <div className="flex gap-1">
          {layouts.map((layout) => (
            <button
              key={layout.id}
              onClick={() => setActiveLayout(layout.id)}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                activeLayout === layout.id
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:bg-gray-200/50"
              )}
            >
              {layout.label}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="p-2 rounded-md hover:bg-gray-200/50 disabled:opacity-30 transition-colors"
          >
            <Undo2 className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 rounded-md hover:bg-gray-200/50 disabled:opacity-30 transition-colors"
          >
            <Redo2 className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={handlePaste}
            className="p-2 rounded-md hover:bg-gray-200/50 transition-colors"
          >
            <Clipboard className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Keyboard Area */}
      <div className="p-2 pt-0">
        {activeLayout === 'numbers' && (
          <div className="flex gap-1.5">
            {/* Left column - variables */}
            <div className="flex flex-col gap-1">
              {[
                { display: 'x', latex: 'x', sup: 'y' },
                { display: 'n', latex: 'n', sup: '' },
                { display: '<', latex: '<', sup: '' },
                { display: '(', latex: '(', sup: '' },
                { display: '⇧', latex: '', isShift: true },
              ].map((key, i) => (
                <button
                  key={i}
                  onClick={() => !key.isShift && handleKeyPress(key.latex)}
                  className={cn(
                    "w-12 h-11 rounded-lg text-lg font-medium transition-all relative",
                    key.isShift
                      ? "bg-[#acb0b9] text-gray-700"
                      : "bg-white shadow-sm hover:bg-gray-50 active:scale-95"
                  )}
                >
                  {key.display}
                  {key.sup && (
                    <span className="absolute top-1 right-1.5 text-[10px] text-gray-400">{key.sup}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Second left column */}
            <div className="flex flex-col gap-1">
              {[
                { display: 'y', latex: 'y', sup: '' },
                { display: 'a', latex: 'a', sup: '' },
                { display: '>', latex: '>', sup: '' },
                { display: ')', latex: ')', sup: '' },
              ].map((key, i) => (
                <button
                  key={i}
                  onClick={() => handleKeyPress(key.latex)}
                  className="w-12 h-11 rounded-lg bg-white shadow-sm text-lg font-medium hover:bg-gray-50 active:scale-95 transition-all relative"
                >
                  {key.display}
                </button>
              ))}
            </div>

            {/* Number pad */}
            <div className="flex-1 grid grid-cols-4 gap-1">
              {numpad.flat().map((key, i) => (
                <button
                  key={i}
                  onClick={() => handleKeyPress(key)}
                  className="h-11 rounded-lg bg-white shadow-sm text-lg font-medium hover:bg-gray-50 active:scale-95 transition-all"
                >
                  {key}
                </button>
              ))}
            </div>

            {/* Right column - special functions */}
            <div className="flex flex-col gap-1">
              {[
                { display: 'e', latex: 'e', sup: 'ln' },
                { display: 'i', latex: 'i', sup: '' },
                { display: '□²', latex: '^{2}', sup: '' },
                { display: '∫', latex: '\\int_{}^{}', sup: '' },
              ].map((key, i) => (
                <button
                  key={i}
                  onClick={() => handleKeyPress(key.latex)}
                  className="w-12 h-11 rounded-lg bg-white shadow-sm text-lg font-medium hover:bg-gray-50 active:scale-95 transition-all relative"
                >
                  {key.display}
                  {key.sup && (
                    <span className="absolute top-1 right-1.5 text-[10px] text-gray-400">{key.sup}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Far right column */}
            <div className="flex flex-col gap-1">
              {[
                { display: 'π', latex: '\\pi', sup: 'sin' },
                { display: '√', latex: '\\sqrt{}', sup: '' },
                { display: '∀', latex: '\\forall', sup: '' },
              ].map((key, i) => (
                <button
                  key={i}
                  onClick={() => handleKeyPress(key.latex)}
                  className="w-12 h-11 rounded-lg bg-white shadow-sm text-lg font-medium hover:bg-gray-50 active:scale-95 transition-all relative"
                >
                  {key.display}
                  {key.sup && (
                    <span className="absolute top-1 right-1.5 text-[10px] text-gray-400">{key.sup}</span>
                  )}
                </button>
              ))}
              <button
                onClick={handleBackspace}
                className="w-12 h-11 rounded-lg bg-[#acb0b9] text-gray-700 hover:bg-[#9ca0a9] active:scale-95 transition-all flex items-center justify-center"
              >
                <Delete className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation column */}
            <div className="flex flex-col gap-1">
              <button
                onClick={handleCursorLeft}
                className="w-10 h-11 rounded-lg bg-[#acb0b9] text-gray-700 hover:bg-[#9ca0a9] active:scale-95 transition-all flex items-center justify-center"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={handleCursorRight}
                className="w-10 h-11 rounded-lg bg-[#acb0b9] text-gray-700 hover:bg-[#9ca0a9] active:scale-95 transition-all flex items-center justify-center"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                onClick={handleInsert}
                className="w-10 h-[90px] rounded-lg bg-[#acb0b9] text-gray-700 hover:bg-[#9ca0a9] active:scale-95 transition-all flex items-center justify-center"
              >
                <CornerDownLeft className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {activeLayout === 'operators' && (
          <div className="grid grid-cols-6 gap-1">
            {operatorKeys.flat().map((key, i) => (
              <button
                key={i}
                onClick={() => handleKeyPress(key)}
                className="h-11 rounded-lg bg-white shadow-sm text-lg font-medium hover:bg-gray-50 active:scale-95 transition-all"
              >
                {key}
              </button>
            ))}
          </div>
        )}

        {activeLayout === 'letters' && (
          <div className="space-y-1">
            {letterKeys.map((row, rowIndex) => (
              <div key={rowIndex} className="flex justify-center gap-1">
                {row.map((key) => (
                  <button
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    className="w-10 h-11 rounded-lg bg-white shadow-sm text-lg font-medium hover:bg-gray-50 active:scale-95 transition-all"
                  >
                    {key}
                  </button>
                ))}
              </div>
            ))}
            <div className="flex justify-center gap-1 pt-1">
              <button
                onClick={() => insertAtCursor(' ')}
                className="w-40 h-10 rounded-lg bg-white shadow-sm text-sm text-gray-500 hover:bg-gray-50 active:scale-95 transition-all"
              >
                space
              </button>
            </div>
          </div>
        )}

        {activeLayout === 'greek' && (
          <div className="space-y-1">
            {greekKeys.map((row, rowIndex) => (
              <div key={rowIndex} className="flex justify-center gap-1">
                {row.map((key) => (
                  <button
                    key={key}
                    onClick={() => handleKeyPress(key)}
                    className="w-11 h-11 rounded-lg bg-white shadow-sm text-lg font-medium hover:bg-gray-50 active:scale-95 transition-all"
                  >
                    {key}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom row with close */}
      <div className="flex justify-end p-2 pt-0">
        <button
          onClick={onClose}
          className="px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-200/50 rounded-md transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
}
