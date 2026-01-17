'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Maximize2, Minimize2 } from 'lucide-react';

interface MathGraphProps {
  equations: string[];
  onClose: () => void;
}

declare global {
  interface Window {
    Desmos: any;
  }
}

export function MathGraph({ equations, onClose }: MathGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<any>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Load Desmos API
  useEffect(() => {
    if (window.Desmos) {
      setLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';
    script.async = true;
    script.onload = () => setLoaded(true);
    document.body.appendChild(script);

    return () => {
      // Don't remove script on cleanup as it may be used by other instances
    };
  }, []);

  // Initialize calculator when loaded
  useEffect(() => {
    if (!loaded || !containerRef.current || !window.Desmos) return;

    // Create calculator
    calculatorRef.current = window.Desmos.GraphingCalculator(containerRef.current, {
      expressions: false, // Hide expression list
      settingsMenu: false,
      zoomButtons: true,
      lockViewport: false,
      border: false,
      keypad: false,
    });

    // Add equations
    equations.forEach((eq, index) => {
      // Clean up the equation for Desmos
      let cleanEq = eq
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/·/g, '*')
        .replace(/\^/g, '^')
        .replace(/sqrt\(/g, '\\sqrt{')
        .replace(/\)/g, '}')
        .replace(/sin\(/g, '\\sin(')
        .replace(/cos\(/g, '\\cos(')
        .replace(/tan\(/g, '\\tan(')
        .replace(/log\(/g, '\\log(')
        .replace(/ln\(/g, '\\ln(')
        .trim();

      // If it's an equation with =, extract the function part
      // e.g., "y = 2x + 1" -> "2x + 1" for graphing as y = ...
      if (cleanEq.includes('=')) {
        const parts = cleanEq.split('=');
        if (parts.length === 2) {
          const left = parts[0].trim();
          const right = parts[1].trim();

          // If left side is just y, graph the right side
          if (left === 'y') {
            cleanEq = right;
          } else if (left === 'x') {
            // Graph x = constant as a vertical line
            calculatorRef.current.setExpression({
              id: `eq-${index}`,
              latex: `x=${right}`,
              color: '#00B4D8',
            });
            return;
          } else {
            // For other equations, try to graph both sides
            cleanEq = right;
          }
        }
      }

      calculatorRef.current.setExpression({
        id: `eq-${index}`,
        latex: `y=${cleanEq}`,
        color: '#00B4D8',
      });
    });

    return () => {
      if (calculatorRef.current) {
        calculatorRef.current.destroy();
      }
    };
  }, [loaded, equations]);

  // Update equations when they change
  useEffect(() => {
    if (!calculatorRef.current) return;

    // Clear existing expressions
    calculatorRef.current.setBlank();

    // Add updated equations
    equations.forEach((eq, index) => {
      let cleanEq = eq
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/·/g, '*')
        .replace(/\^/g, '^')
        .trim();

      if (cleanEq.includes('=')) {
        const parts = cleanEq.split('=');
        if (parts.length === 2) {
          const left = parts[0].trim();
          const right = parts[1].trim();

          if (left === 'y') {
            cleanEq = right;
          } else if (left === 'x') {
            calculatorRef.current.setExpression({
              id: `eq-${index}`,
              latex: `x=${right}`,
              color: '#00B4D8',
            });
            return;
          } else {
            cleanEq = right;
          }
        }
      }

      calculatorRef.current.setExpression({
        id: `eq-${index}`,
        latex: `y=${cleanEq}`,
        color: '#00B4D8',
      });
    });
  }, [equations]);

  return (
    <div
      className={`absolute bg-white rounded-lg shadow-xl border overflow-hidden transition-all duration-200 ${
        isExpanded
          ? 'inset-4 z-50'
          : 'bottom-4 right-4 w-80 h-64 z-30'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b">
        <span className="text-sm font-medium text-gray-700">Graph</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Graph container */}
      <div
        ref={containerRef}
        className="w-full"
        style={{ height: isExpanded ? 'calc(100% - 41px)' : '223px' }}
      />

      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-white">
          <div className="text-sm text-gray-500">Loading graph...</div>
        </div>
      )}
    </div>
  );
}
