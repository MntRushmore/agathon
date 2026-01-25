'use client';

import React, { useEffect, useRef, useState } from 'react';

interface InlineDesmosProps {
  expression?: string;
  height?: number;
}

interface DesmosCalculator {
  setExpression: (expr: { id: string; latex: string }) => void;
  destroy: () => void;
}

interface DesmosAPI {
  GraphingCalculator: (element: HTMLElement, options?: Record<string, unknown>) => DesmosCalculator;
}

export function InlineDesmos({ expression, height = 400 }: InlineDesmosProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const calculatorRef = useRef<DesmosCalculator | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Load Desmos API script
    const win = window as Window & { Desmos?: DesmosAPI };
    if (!win.Desmos) {
      const script = document.createElement('script');
      script.src = 'https://www.desmos.com/api/v1.9/calculator.js?apiKey=dcb31709b452b1cf9dc26972add0fda6';
      script.async = true;
      script.onload = () => setLoaded(true);
      document.head.appendChild(script);
    } else {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    const win = window as Window & { Desmos?: DesmosAPI };
    if (!loaded || !containerRef.current || !win.Desmos) return;

    // Create calculator with expressions panel visible
    const calculator = win.Desmos.GraphingCalculator(containerRef.current, {
      expressions: true,
      settingsMenu: true,
      zoomButtons: true,
      expressionsCollapsed: false,
    });

    calculatorRef.current = calculator;

    // Set initial expression if provided
    if (expression) {
      calculator.setExpression({ id: 'graph1', latex: expression });
    }

    return () => {
      if (calculatorRef.current) {
        calculatorRef.current.destroy();
      }
    };
  }, [loaded, expression]);

  return (
    <div
      ref={containerRef}
      className="inline-desmos rounded-xl overflow-hidden border border-gray-200 my-4"
      style={{ height: `${height}px`, width: '100%' }}
    />
  );
}
