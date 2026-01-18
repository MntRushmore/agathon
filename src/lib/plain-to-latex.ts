/**
 * Plain Math to LaTeX Converter
 *
 * Converts plain text math notation to proper LaTeX syntax
 * for rendering with KaTeX or MathLive.
 */

// Greek letter mappings
const GREEK_LETTERS: Record<string, string> = {
  alpha: '\\alpha',
  beta: '\\beta',
  gamma: '\\gamma',
  delta: '\\delta',
  epsilon: '\\epsilon',
  zeta: '\\zeta',
  eta: '\\eta',
  theta: '\\theta',
  iota: '\\iota',
  kappa: '\\kappa',
  lambda: '\\lambda',
  mu: '\\mu',
  nu: '\\nu',
  xi: '\\xi',
  pi: '\\pi',
  rho: '\\rho',
  sigma: '\\sigma',
  tau: '\\tau',
  upsilon: '\\upsilon',
  phi: '\\phi',
  chi: '\\chi',
  psi: '\\psi',
  omega: '\\omega',
  // Capitals
  Gamma: '\\Gamma',
  Delta: '\\Delta',
  Theta: '\\Theta',
  Lambda: '\\Lambda',
  Xi: '\\Xi',
  Pi: '\\Pi',
  Sigma: '\\Sigma',
  Phi: '\\Phi',
  Psi: '\\Psi',
  Omega: '\\Omega',
};

// Function mappings
const FUNCTIONS: Record<string, string> = {
  sqrt: '\\sqrt',
  sin: '\\sin',
  cos: '\\cos',
  tan: '\\tan',
  log: '\\log',
  ln: '\\ln',
  exp: '\\exp',
  lim: '\\lim',
  sum: '\\sum',
  prod: '\\prod',
  int: '\\int',
};

// Symbol mappings
const SYMBOLS: Record<string, string> = {
  '>=': '\\geq',
  '<=': '\\leq',
  '!=': '\\neq',
  '+-': '\\pm',
  '-+': '\\mp',
  '...': '\\ldots',
  inf: '\\infty',
  infinity: '\\infty',
};

/**
 * Convert plain text math to LaTeX
 */
export function toLatex(plainMath: string): string {
  let latex = plainMath.trim();

  // Remove explicit $ delimiters if present
  if (latex.startsWith('$') && latex.endsWith('$')) {
    latex = latex.slice(1, -1);
  }

  // If it already looks like LaTeX (has backslashes), return as-is
  if (latex.includes('\\')) {
    return latex;
  }

  // Convert symbols first (before other transformations)
  for (const [plain, tex] of Object.entries(SYMBOLS)) {
    latex = latex.replace(new RegExp(escapeRegex(plain), 'g'), tex);
  }

  // Convert Greek letters
  for (const [name, tex] of Object.entries(GREEK_LETTERS)) {
    // Word boundary to avoid partial matches
    latex = latex.replace(new RegExp(`\\b${name}\\b`, 'g'), tex);
  }

  // Convert functions like sqrt(x) to \sqrt{x}
  for (const [name, tex] of Object.entries(FUNCTIONS)) {
    // sqrt(x) → \sqrt{x}
    const funcPattern = new RegExp(`${name}\\s*\\(([^)]+)\\)`, 'gi');
    latex = latex.replace(funcPattern, `${tex}{$1}`);
  }

  // Convert fractions: a/b → \frac{a}{b}
  // But only simple fractions, not complex expressions
  latex = latex.replace(/(\d+|\([^)]+\)|[a-zA-Z])\s*\/\s*(\d+|\([^)]+\)|[a-zA-Z])/g, (_, num, den) => {
    // Remove parentheses if they wrap the whole expression
    const cleanNum = num.replace(/^\((.+)\)$/, '$1');
    const cleanDen = den.replace(/^\((.+)\)$/, '$1');
    return `\\frac{${cleanNum}}{${cleanDen}}`;
  });

  // Convert powers: x^2 → x^{2}, x^{2} already correct
  // Handle multi-digit exponents: x^12 → x^{12}
  latex = latex.replace(/\^(\d{2,})/g, '^{$1}');
  // Handle negative exponents: x^-2 → x^{-2}
  latex = latex.replace(/\^(-\d+)/g, '^{$1}');
  // Handle parenthesized exponents: x^(n+1) → x^{n+1}
  latex = latex.replace(/\^\(([^)]+)\)/g, '^{$1}');

  // Convert subscripts: x_1 → x_{1}, x_12 → x_{12}
  latex = latex.replace(/_(\d{2,})/g, '_{$1}');
  latex = latex.replace(/_\(([^)]+)\)/g, '_{$1}');

  // Convert multiplication: 3*x → 3 \cdot x (optional, some prefer no symbol)
  // latex = latex.replace(/(\d)\s*\*\s*([a-zA-Z])/g, '$1 \\cdot $2');

  // Add spacing around equals for readability
  latex = latex.replace(/\s*=\s*/g, ' = ');

  // Add spacing around +/- for readability (but not in exponents)
  latex = latex.replace(/([^{^_])\s*\+\s*([^}])/g, '$1 + $2');
  latex = latex.replace(/([^{^_])\s*-\s*([^}])/g, '$1 - $2');

  return latex.trim();
}

/**
 * Convert LaTeX back to plain text (for editing)
 */
export function fromLatex(latex: string): string {
  let plain = latex;

  // Convert Greek letters back
  for (const [name, tex] of Object.entries(GREEK_LETTERS)) {
    plain = plain.replace(new RegExp(escapeRegex(tex), 'g'), name);
  }

  // Convert fractions: \frac{a}{b} → a/b
  plain = plain.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)');

  // Convert functions: \sqrt{x} → sqrt(x)
  for (const [name, tex] of Object.entries(FUNCTIONS)) {
    plain = plain.replace(new RegExp(`${escapeRegex(tex)}\\{([^}]+)\\}`, 'g'), `${name}($1)`);
  }

  // Convert symbols back
  for (const [plainSym, tex] of Object.entries(SYMBOLS)) {
    plain = plain.replace(new RegExp(escapeRegex(tex), 'g'), plainSym);
  }

  // Remove remaining backslashes (from unrecognized commands)
  plain = plain.replace(/\\/g, '');

  // Clean up braces
  plain = plain.replace(/\{([^{}]+)\}/g, '$1');

  return plain.trim();
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if a string is already valid LaTeX
 */
export function isLatex(str: string): boolean {
  return str.includes('\\') || str.includes('{') || str.includes('}');
}

/**
 * Normalize LaTeX for consistent storage
 */
export function normalizeLatex(latex: string): string {
  // Remove extra whitespace
  let normalized = latex.replace(/\s+/g, ' ').trim();

  // Ensure consistent spacing around operators
  normalized = normalized.replace(/\s*([=+])\s*/g, ' $1 ');
  normalized = normalized.replace(/\s*(-)\s*(?![}\d])/g, ' $1 ');

  return normalized;
}
