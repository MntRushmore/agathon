/**
 * Math Detection Engine
 *
 * Automatically detects mathematical expressions in plain text
 * and splits the text into segments (text or math).
 */

export interface Segment {
  type: 'text' | 'math';
  content: string;
}

// Patterns that indicate mathematical content
// Order matters - more specific patterns should come first
const MATH_PATTERNS = [
  // Explicit math delimiters (highest priority)
  /\$([^$]+)\$/g,                           // $...$
  /\\\(([^)]+)\\\)/g,                       // \(...\)

  // Complex expressions
  /sqrt\s*\([^)]+\)/gi,                     // sqrt(...)
  /\([^)]+\)\s*\^/g,                        // (...)^
  /\w+\s*\^\s*\{[^}]+\}/g,                  // x^{...}

  // Fractions
  /\d+\s*\/\s*\d+/g,                        // 1/2, 3/4
  /[a-z]\s*\/\s*[a-z]/gi,                   // a/b

  // Equations with equals
  /[a-z]\s*=\s*-?\d+(?:\.\d+)?/gi,          // x = 5, y = -3.5
  /\d+[a-z]\s*[+\-]\s*\d+\s*=\s*\d+/gi,     // 3x + 2 = 5
  /[a-z]\s*=\s*\d*[a-z](?:\s*[+\-*/^]\s*\d*[a-z]?)*/gi, // y = 2x + 1, y = mx + b

  // Expressions with variables and operators
  /\d+[a-z]\s*\^\s*\d+/gi,                  // 3x^2
  /[a-z]\s*\^\s*\d+/gi,                     // x^2
  /\d+[a-z]\s*[+\-]\s*\d+/gi,               // 3x + 2
  /[a-z]\s*[+\-*/]\s*\d+/gi,                // x + 2
  /\d+\s*[+\-*/]\s*[a-z]/gi,                // 2 + x

  // Greek letters (common in math)
  /\b(alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|phi|omega|tau|rho)\b/gi,

  // Pure arithmetic (be careful with false positives)
  /\d+\s*[\^]\s*\d+/g,                      // 2^3 (powers)
];

// Words/patterns that should NOT be detected as math
const FALSE_POSITIVE_PATTERNS = [
  /^[A-Z]$/,                                // Single capital letter (often initials)
  /^I$/i,                                   // "I" by itself
  /^a$/i,                                   // "a" by itself (article)
  /\b[A-Za-z]+ing\b/,                       // Words ending in -ing
  /\b[A-Za-z]+tion\b/,                      // Words ending in -tion
  /\b[A-Za-z]+ly\b/,                        // Adverbs
];

/**
 * Check if a string is likely a false positive (not actually math)
 */
function isFalsePositive(str: string): boolean {
  const trimmed = str.trim();

  // Very short strings are usually not math
  if (trimmed.length < 2) return true;

  // Check against false positive patterns
  for (const pattern of FALSE_POSITIVE_PATTERNS) {
    if (pattern.test(trimmed)) return true;
  }

  // Single letters without operators are usually not math
  if (/^[a-zA-Z]$/.test(trimmed)) return true;

  return false;
}

/**
 * Check if a string looks like a math expression
 */
export function isMathExpression(str: string): boolean {
  if (isFalsePositive(str)) return false;

  const trimmed = str.trim();

  // Must have at least one of: number, operator, equals, or Greek letter
  const hasMathChar = /[\d+\-*/=^]/.test(trimmed) ||
                      /\b(alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|phi|omega)\b/i.test(trimmed);

  if (!hasMathChar) return false;

  // Check if it matches any of our patterns
  for (const pattern of MATH_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    if (pattern.test(trimmed)) return true;
  }

  return false;
}

/**
 * Find all math expressions in a text string
 * Returns array of {start, end, content} for each match
 */
interface MathMatch {
  start: number;
  end: number;
  content: string;
}

function findMathMatches(text: string): MathMatch[] {
  const matches: MathMatch[] = [];
  const seen = new Set<string>(); // Avoid duplicate positions

  for (const pattern of MATH_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;

    let match;
    while ((match = pattern.exec(text)) !== null) {
      const start = match.index;
      const content = match[1] || match[0]; // Use capture group if exists
      const end = start + match[0].length;

      const key = `${start}-${end}`;
      if (!seen.has(key) && !isFalsePositive(content)) {
        seen.add(key);
        matches.push({ start, end, content: match[0] });
      }
    }
  }

  // Sort by start position
  matches.sort((a, b) => a.start - b.start);

  // Remove overlapping matches (keep the longer one)
  const filtered: MathMatch[] = [];
  for (const match of matches) {
    const last = filtered[filtered.length - 1];
    if (!last || match.start >= last.end) {
      filtered.push(match);
    } else if (match.end - match.start > last.end - last.start) {
      // Current match is longer, replace
      filtered[filtered.length - 1] = match;
    }
  }

  return filtered;
}

/**
 * Detect and split text into segments of text and math
 */
export function detectMathSegments(text: string): Segment[] {
  if (!text || text.trim() === '') {
    return [{ type: 'text', content: text }];
  }

  const mathMatches = findMathMatches(text);

  if (mathMatches.length === 0) {
    return [{ type: 'text', content: text }];
  }

  const segments: Segment[] = [];
  let lastEnd = 0;

  for (const match of mathMatches) {
    // Add text before this match
    if (match.start > lastEnd) {
      const textContent = text.slice(lastEnd, match.start);
      if (textContent) {
        segments.push({ type: 'text', content: textContent });
      }
    }

    // Add the math segment
    segments.push({ type: 'math', content: match.content });
    lastEnd = match.end;
  }

  // Add remaining text
  if (lastEnd < text.length) {
    const remaining = text.slice(lastEnd);
    if (remaining) {
      segments.push({ type: 'text', content: remaining });
    }
  }

  return segments;
}

/**
 * Merge adjacent segments of the same type
 */
export function mergeSegments(segments: Segment[]): Segment[] {
  if (segments.length <= 1) return segments;

  const merged: Segment[] = [];

  for (const segment of segments) {
    const last = merged[merged.length - 1];
    if (last && last.type === segment.type) {
      last.content += segment.content;
    } else {
      merged.push({ ...segment });
    }
  }

  return merged;
}

/**
 * Convert segments back to plain text
 */
export function segmentsToText(segments: Segment[]): string {
  return segments.map(s => s.content).join('');
}

/**
 * Check if segments contain any math
 */
export function hasMath(segments: Segment[]): boolean {
  return segments.some(s => s.type === 'math');
}
