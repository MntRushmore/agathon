'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Maximize2, Minimize2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GraphPanelProps {
  equations: string[];
  onClose: () => void;
  onRemoveEquation?: (latex: string) => void;
}

// Color palette for multiple equations
const GRAPH_COLORS = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#9333ea', // purple
  '#ea580c', // orange
  '#0891b2', // cyan
];

export function GraphPanel({ equations, onClose, onRemoveEquation }: GraphPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load Desmos script
  useEffect(() => {
    if ((window as any).Desmos) {
      setLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';
    script.async = true;
    script.onload = () => setLoaded(true);
    document.body.appendChild(script);
  }, []);

  // Initialize calculator
  useEffect(() => {
    if (!loaded || !containerRef.current || !(window as any).Desmos) return;

    calculatorRef.current = (window as any).Desmos.GraphingCalculator(containerRef.current, {
      expressions: false,
      settingsMenu: false,
      zoomButtons: true,
      lockViewport: false,
      border: false,
      keypad: false,
    });

    return () => {
      if (calculatorRef.current) {
        calculatorRef.current.destroy();
      }
    };
  }, [loaded]);

  // Update equations
  useEffect(() => {
    if (!calculatorRef.current) return;

    calculatorRef.current.setBlank();

    equations.forEach((eq, index) => {
      // Clean up the equation for Desmos
      let cleanEq = eq
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/·/g, '*')
        .replace(/^=\s*/, '')
        .trim();

      // Skip empty equations
      if (!cleanEq) return;

      // If it's just an expression with x, wrap it as y=
      if (!cleanEq.includes('=') && cleanEq.includes('x')) {
        cleanEq = `y=${cleanEq}`;
      }

      calculatorRef.current.setExpression({
        id: `eq-${index}`,
        latex: cleanEq,
        color: GRAPH_COLORS[index % GRAPH_COLORS.length],
      });
    });
  }, [equations]);

  return (
    <div
      className={cn(
        'fixed bg-white rounded-lg shadow-2xl border overflow-hidden transition-all duration-300 z-50',
        isExpanded
          ? 'inset-8'
          : 'bottom-20 right-4 w-96 h-80'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b">
        <span className="text-sm font-semibold text-gray-700">Graph</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Minimize' : 'Expand'}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 hover:bg-red-50 hover:text-red-500"
            onClick={onClose}
            title="Close graph"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Graph Container */}
      <div
        ref={containerRef}
        className="w-full bg-white"
        style={{ height: isExpanded ? 'calc(100% - 41px - 60px)' : 'calc(100% - 41px - 60px)' }}
      />

      {/* Equation List */}
      <div className="absolute bottom-0 left-0 right-0 bg-gray-50 border-t p-2 max-h-[60px] overflow-y-auto">
        <div className="flex flex-wrap gap-1">
          {equations.map((eq, index) => (
            <div
              key={index}
              className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded border text-xs"
              style={{ borderLeftColor: GRAPH_COLORS[index % GRAPH_COLORS.length], borderLeftWidth: 3 }}
            >
              <span className="font-mono truncate max-w-[120px]">{eq || 'Empty'}</span>
              {onRemoveEquation && (
                <button
                  onClick={() => onRemoveEquation(eq)}
                  className="text-gray-400 hover:text-red-500"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
        {equations.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-1">
            No equations graphed. Click the graph button on an equation.
          </p>
        )}
      </div>

      {/* Loading State */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="text-sm text-gray-500">Loading graph...</div>
        </div>
      )}
    </div>
  );
}
