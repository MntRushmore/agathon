'use client';

import React from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';
import DOMPurify from 'dompurify';

interface LatexRendererProps {
  content: string;
  className?: string;
}

// Parse content and render LaTeX expressions + markdown
// $...$ for inline math
// $$...$$ for block/display math
// **bold**, *italic*, `code`, ```code blocks```, lists
export function LatexRenderer({ content, className = '' }: LatexRendererProps) {
  const renderContent = () => {
    const parts: React.ReactNode[] = [];
    let remaining = content;
    let key = 0;

    // Process block math first ($$...$$)
    while (remaining.length > 0) {
      // Look for block math $$...$$
      const blockMatch = remaining.match(/\$\$([^$]+)\$\$/);
      if (blockMatch && blockMatch.index !== undefined) {
        // Add text before the match
        if (blockMatch.index > 0) {
          const beforeText = remaining.slice(0, blockMatch.index);
          parts.push(...renderInlineMath(beforeText, key));
          key += 100;
        }

        // Render block math
        try {
          const html = katex.renderToString(blockMatch[1].trim(), {
            displayMode: true,
            throwOnError: false,
          });
          const safeHtml = DOMPurify.sanitize(html);
          parts.push(
            <div
              key={`block-${key++}`}
              className="my-2 overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          );
        } catch {
          parts.push(
            <div key={`block-err-${key++}`} className="my-2 text-red-500">
              {blockMatch[0]}
            </div>
          );
        }

        remaining = remaining.slice(blockMatch.index + blockMatch[0].length);
      } else {
        // No more block math, process remaining for inline math
        parts.push(...renderInlineMath(remaining, key));
        break;
      }
    }

    return parts;
  };

  // Render inline math ($...$) within text
  const renderInlineMath = (text: string, startKey: number): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let key = startKey;

    while (remaining.length > 0) {
      // Look for inline math $...$
      // Use a simpler regex that avoids lookbehind (not supported in all browsers)
      // Find first $ that's not followed by another $
      let startIdx = -1;
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i] === '$') {
          // Check if it's not part of $$
          if (remaining[i + 1] !== '$' && (i === 0 || remaining[i - 1] !== '$')) {
            startIdx = i;
            break;
          }
        }
      }

      if (startIdx === -1) {
        // No inline math found
        if (remaining) {
          parts.push(
            <span key={`text-final-${key++}`}>{formatText(remaining, key)}</span>
          );
        }
        break;
      }

      // Find closing $
      let endIdx = -1;
      for (let i = startIdx + 1; i < remaining.length; i++) {
        if (remaining[i] === '$' && remaining[i + 1] !== '$' && remaining[i - 1] !== '$') {
          // Also make sure there's no newline in between
          const content = remaining.slice(startIdx + 1, i);
          if (!content.includes('\n')) {
            endIdx = i;
            break;
          }
        }
      }

      if (endIdx === -1) {
        // No closing $ found, treat rest as text
        if (remaining) {
          parts.push(
            <span key={`text-final-${key++}`}>{formatText(remaining, key)}</span>
          );
        }
        break;
      }

      // Add text before the match
      if (startIdx > 0) {
        parts.push(
          <span key={`text-${key++}`}>
            {formatText(remaining.slice(0, startIdx), key)}
          </span>
        );
      }

      // Extract and render inline math
      const mathContent = remaining.slice(startIdx + 1, endIdx);
        try {
          const html = katex.renderToString(mathContent.trim(), {
            displayMode: false,
            throwOnError: false,
          });
          const safeHtml = DOMPurify.sanitize(html);
          parts.push(
            <span
              key={`inline-${key++}`}
              className="inline-block align-middle"
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          );
        } catch {
        parts.push(
          <span key={`inline-err-${key++}`} className="text-red-500">
            ${mathContent}$
          </span>
        );
      }

      remaining = remaining.slice(endIdx + 1);
    }

    return parts;
  };

  // Format inline markdown: **bold**, *italic*, `code`
  const formatInline = (text: string, baseKey: number): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let key = baseKey;

    // Process inline code first (backticks), then bold, then italic
    // Using a single regex pass to handle all inline formatting
    const inlineRegex = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = inlineRegex.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }

      if (match[1]) {
        // Inline code: `code`
        const code = match[1].slice(1, -1);
        parts.push(
          <code key={`code-${key++}`} className="px-1.5 py-0.5 rounded bg-muted text-[0.85em] font-mono">
            {code}
          </code>
        );
      } else if (match[2]) {
        // Bold: **text**
        const bold = match[2].slice(2, -2);
        parts.push(
          <strong key={`bold-${key++}`} className="font-semibold">
            {bold}
          </strong>
        );
      } else if (match[3]) {
        // Italic: *text*
        const italic = match[3].slice(1, -1);
        parts.push(
          <em key={`italic-${key++}`}>
            {italic}
          </em>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    // If no matches found, return original text
    if (parts.length === 0) {
      parts.push(text);
    }

    return parts;
  };

  // Format text with markdown support
  const formatText = (text: string, baseKey: number): React.ReactNode => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let key = baseKey;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Code block: ```...```
      if (trimmed.startsWith('```')) {
        const codeLines: string[] = [];
        i++; // skip opening ```
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        i++; // skip closing ```
        elements.push(
          <pre
            key={`codeblock-${key++}`}
            className="my-2 p-3 rounded-lg bg-muted overflow-x-auto text-[0.85em] font-mono leading-relaxed"
          >
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        continue;
      }

      // Bullet list: - item or * item (not bold)
      if (/^[-*]\s/.test(trimmed) && !/^\*[^*]+\*$/.test(trimmed)) {
        const listItems: string[] = [];
        while (i < lines.length && /^\s*[-*]\s/.test(lines[i])) {
          listItems.push(lines[i].replace(/^\s*[-*]\s/, ''));
          i++;
        }
        elements.push(
          <ul key={`ul-${key++}`} className="my-1.5 ml-4 space-y-0.5 list-disc">
            {listItems.map((item, idx) => (
              <li key={idx} className="text-sm leading-relaxed">
                {formatInline(item, key + idx * 10)}
              </li>
            ))}
          </ul>
        );
        key += listItems.length * 10;
        continue;
      }

      // Numbered list: 1. item, 2. item
      if (/^\d+[.)]\s/.test(trimmed)) {
        const listItems: string[] = [];
        while (i < lines.length && /^\s*\d+[.)]\s/.test(lines[i])) {
          listItems.push(lines[i].replace(/^\s*\d+[.)]\s/, ''));
          i++;
        }
        elements.push(
          <ol key={`ol-${key++}`} className="my-1.5 ml-4 space-y-0.5 list-decimal">
            {listItems.map((item, idx) => (
              <li key={idx} className="text-sm leading-relaxed">
                {formatInline(item, key + idx * 10)}
              </li>
            ))}
          </ol>
        );
        key += listItems.length * 10;
        continue;
      }

      // Regular line with inline formatting
      elements.push(
        <React.Fragment key={`line-${key++}`}>
          {formatInline(line, key)}
          {i < lines.length - 1 && <br />}
        </React.Fragment>
      );
      i++;
    }

    return <>{elements}</>;
  };

  return <div className={className}>{renderContent()}</div>;
}
