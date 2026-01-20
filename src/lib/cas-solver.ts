/**
 * CAS (Computer Algebra System) Solver using nerdamer
 * Provides instant math computation without needing an LLM
 */

// Nerdamer doesn't have official types, so we use require
// eslint-disable-next-line @typescript-eslint/no-var-requires
const nerdamer = require('nerdamer');
require('nerdamer/Algebra');
require('nerdamer/Calculus');
require('nerdamer/Solve');

export interface QuickSolveResult {
  answer: string;
  success: boolean;
  error?: string;
}

/**
 * Convert LaTeX notation to plain math that nerdamer understands
 */
function latexToPlain(latex: string): string {
  let plain = latex;

  // Remove dollar signs
  plain = plain.replace(/\$/g, '');

  // Convert fractions: \frac{a}{b} -> (a)/(b)
  plain = plain.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');

  // Convert powers: x^{2} -> x^(2) and x^2 stays x^2
  plain = plain.replace(/\^{([^}]+)}/g, '^($1)');

  // Convert square roots: \sqrt{x} -> sqrt(x)
  plain = plain.replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)');

  // Convert nth roots: \sqrt[n]{x} -> x^(1/n)
  plain = plain.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '($2)^(1/($1))');

  // Convert trig functions
  plain = plain.replace(/\\sin/g, 'sin');
  plain = plain.replace(/\\cos/g, 'cos');
  plain = plain.replace(/\\tan/g, 'tan');
  plain = plain.replace(/\\arcsin/g, 'asin');
  plain = plain.replace(/\\arccos/g, 'acos');
  plain = plain.replace(/\\arctan/g, 'atan');
  plain = plain.replace(/\\log/g, 'log');
  plain = plain.replace(/\\ln/g, 'log');

  // Convert pi and e
  plain = plain.replace(/\\pi/g, 'pi');

  // Convert multiplication (implicit and explicit)
  plain = plain.replace(/\\cdot/g, '*');
  plain = plain.replace(/\\times/g, '*');

  // Convert division
  plain = plain.replace(/\\div/g, '/');

  // Remove \left and \right
  plain = plain.replace(/\\left/g, '');
  plain = plain.replace(/\\right/g, '');

  // Remove remaining backslashes from commands we don't recognize
  plain = plain.replace(/\\[a-zA-Z]+/g, '');

  // Clean up spaces
  plain = plain.replace(/\s+/g, ' ').trim();

  return plain;
}

/**
 * Format the solution from nerdamer into a readable string
 */
function formatSolution(solutions: any): string {
  if (Array.isArray(solutions)) {
    // Multiple solutions (e.g., quadratic equation)
    if (solutions.length === 0) return '?';

    // Check if solutions are [variable, value] pairs
    if (Array.isArray(solutions[0])) {
      return solutions
        .map((s: any[]) => `${s[0]} = ${s[1]}`)
        .join(', ');
    }

    // Simple array of values
    return solutions.map((s: any) => s.toString()).join(', ');
  }

  return solutions.toString();
}

/**
 * Quick solve using CAS - returns instant results for supported expressions
 */
export function quickSolve(expression: string): QuickSolveResult {
  try {
    // Clean the input
    const cleaned = latexToPlain(expression);

    if (!cleaned || cleaned.trim() === '') {
      return { answer: '', success: false, error: 'Empty expression' };
    }

    // Check if it's an equation (contains =)
    if (cleaned.includes('=')) {
      // Split into left and right sides
      const parts = cleaned.split('=').map(p => p.trim());
      if (parts.length !== 2) {
        return { answer: '', success: false, error: 'Invalid equation format' };
      }

      // Try to solve the equation
      // nerdamer.solveEquations expects the equation as "left = right" or just the expression if solving for x
      try {
        const solutions = nerdamer.solveEquations(cleaned);
        const answer = formatSolution(solutions);
        return { answer, success: true };
      } catch {
        // If direct solve fails, try rearranging: left - right = 0
        const rearranged = `(${parts[0]}) - (${parts[1]})`;
        const solutions = nerdamer.solveEquations(rearranged);
        const answer = formatSolution(solutions);
        return { answer, success: true };
      }
    } else {
      // It's an expression to evaluate
      const result = nerdamer(cleaned).evaluate();
      let answer = result.text();

      // Try to convert to a decimal if it's a fraction
      try {
        const numericResult = nerdamer(cleaned).evaluate().valueOf();
        if (typeof numericResult === 'number' && !isNaN(numericResult)) {
          // Round to 6 decimal places max
          const rounded = Math.round(numericResult * 1000000) / 1000000;
          answer = rounded.toString();
        }
      } catch {
        // Keep the symbolic answer
      }

      return { answer, success: true };
    }
  } catch (error) {
    return {
      answer: '',
      success: false,
      error: error instanceof Error ? error.message : 'Calculation failed',
    };
  }
}

/**
 * Check if an expression is likely solvable by CAS
 * Returns false for complex expressions that need LLM
 */
export function canQuickSolve(expression: string): boolean {
  const cleaned = latexToPlain(expression);

  // Empty or too short
  if (!cleaned || cleaned.length < 2) return false;

  // Contains words that suggest it needs interpretation
  const needsInterpretation = [
    'solve',
    'find',
    'calculate',
    'simplify',
    'expand',
    'factor',
    'derivative',
    'integral',
    'limit',
    'what',
    'how',
  ];

  const lowerCleaned = cleaned.toLowerCase();
  if (needsInterpretation.some(word => lowerCleaned.includes(word))) {
    return false;
  }

  // Check for basic mathematical structure
  const hasNumbers = /\d/.test(cleaned);
  const hasOperators = /[+\-*/^=]/.test(cleaned);

  return hasNumbers || hasOperators;
}
