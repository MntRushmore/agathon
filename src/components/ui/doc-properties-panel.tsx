'use client';

/**
 * Document Properties Panel
 * Slide-in right drawer: tags, subject, color label, creation date, word count.
 */

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { X, Tag, BookOpen, Calendar, Hash } from '@phosphor-icons/react';

// ── Types ────────────────────────────────────────────────

export interface DocProperties {
  subject?: string;
  tags?: string[];
  color?: string | null;
  createdAt?: string;
  updatedAt?: string;
  wordCount?: number;
}

interface DocPropertiesPanelProps {
  open: boolean;
  onClose: () => void;
  properties: DocProperties;
  onChange: (updated: Partial<DocProperties>) => void;
}

// ── Color options ────────────────────────────────────────

const COLORS: { id: string; hex: string; label: string }[] = [
  { id: 'none', hex: '', label: 'None' },
  { id: 'red', hex: '#ef4444', label: 'Red' },
  { id: 'orange', hex: '#f97316', label: 'Orange' },
  { id: 'yellow', hex: '#eab308', label: 'Yellow' },
  { id: 'green', hex: '#22c55e', label: 'Green' },
  { id: 'blue', hex: '#3b82f6', label: 'Blue' },
  { id: 'purple', hex: '#a855f7', label: 'Purple' },
  { id: 'pink', hex: '#ec4899', label: 'Pink' },
  { id: 'gray', hex: '#6b7280', label: 'Gray' },
];

// ── Component ────────────────────────────────────────────

export function DocPropertiesPanel({ open, onClose, properties, onChange }: DocPropertiesPanelProps) {
  const [tagInput, setTagInput] = useState('');
  const tagInputRef = useRef<HTMLInputElement>(null);

  const tags = properties.tags ?? [];
  const color = properties.color ?? null;

  const handleAddTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, '');
    if (!trimmed || tags.includes(trimmed)) {
      setTagInput('');
      return;
    }
    onChange({ tags: [...tags, trimmed] });
    setTagInput('');
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddTag();
    }
    if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      onChange({ tags: tags.slice(0, -1) });
    }
  };

  const removeTag = (tag: string) => onChange({ tags: tags.filter(t => t !== tag) });

  const setColor = (c: string | null) => onChange({ color: c });

  const setSubject = (s: string) => onChange({ subject: s });

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-[150] bg-black/20 transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed right-0 top-0 bottom-0 z-[160] w-[300px] bg-white border-l border-[#e2e4e8] flex flex-col shadow-2xl',
          'transition-transform duration-250 ease-out',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#f0f1f3]">
          <span className="text-[13px] font-semibold text-[#1a1d2b]">Properties</span>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-6 h-6 rounded-lg text-[#9096a2] hover:text-[#1a1d2b] hover:bg-[#f0f1f3] transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 px-4 space-y-5">

          {/* Color label */}
          <div>
            <PropLabel icon={<Hash className="h-3.5 w-3.5" weight="duotone" />} label="Color label" />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setColor(c.id === 'none' ? null : c.hex)}
                  title={c.label}
                  className={cn(
                    'w-6 h-6 rounded-full border-2 transition-all',
                    c.id === 'none'
                      ? cn('bg-white border-[#e2e4e8]', !color && 'border-[#1e6ee8] shadow-[0_0_0_2px_rgba(30,110,232,0.2)]')
                      : cn('border-transparent hover:scale-110', color === c.hex && 'border-white shadow-[0_0_0_2px_rgba(0,0,0,0.15),0_0_0_4px_' + c.hex + '55]')
                  )}
                  style={{ backgroundColor: c.hex || undefined }}
                >
                  {c.id === 'none' && !color && (
                    <span className="flex items-center justify-center w-full h-full text-[#1e6ee8]">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M3 6.5L1 4.5l.7-.7 1.3 1.3 2.3-2.3.7.7L3 6.5z" /></svg>
                    </span>
                  )}
                </button>
              ))}
            </div>
            {color && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[11px] text-[#9096a2]">{COLORS.find(c => c.hex === color)?.label ?? 'Custom'}</span>
              </div>
            )}
          </div>

          <Separator />

          {/* Subject */}
          <div>
            <PropLabel icon={<BookOpen className="h-3.5 w-3.5" weight="duotone" />} label="Subject" />
            <input
              type="text"
              value={properties.subject ?? ''}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Calculus, History, Chemistry"
              className="mt-2 w-full h-8 px-3 text-[12px] rounded-lg border border-[#e2e4e8] bg-[#f8f9fa] text-[#1a1d2b] placeholder:text-[#c4c7cd] focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1e6ee8]/20 focus:border-[#1e6ee8] transition-all"
            />
          </div>

          <Separator />

          {/* Tags */}
          <div>
            <PropLabel icon={<Tag className="h-3.5 w-3.5" weight="duotone" />} label="Tags" />
            <div
              className="mt-2 min-h-[36px] px-2 py-1.5 flex flex-wrap gap-1 rounded-lg border border-[#e2e4e8] bg-[#f8f9fa] cursor-text focus-within:bg-white focus-within:border-[#1e6ee8] focus-within:ring-2 focus-within:ring-[#1e6ee8]/20 transition-all"
              onClick={() => tagInputRef.current?.focus()}
            >
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#eef3fd] text-[#1e6ee8] text-[11px] font-medium"
                >
                  #{tag}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                    className="text-[#1e6ee8]/60 hover:text-[#1e6ee8] transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onBlur={handleAddTag}
                placeholder={tags.length === 0 ? 'Add tags…' : ''}
                className="flex-1 min-w-[80px] h-5 bg-transparent text-[12px] text-[#1a1d2b] placeholder:text-[#c4c7cd] outline-none border-none"
              />
            </div>
            <p className="text-[10px] text-[#c4c7cd] mt-1">Press Enter or comma to add</p>
          </div>

          <Separator />

          {/* Metadata */}
          <div className="space-y-2.5">
            <PropLabel icon={<Calendar className="h-3.5 w-3.5" weight="duotone" />} label="Info" />
            <div className="space-y-2 mt-2">
              {properties.createdAt && (
                <MetaRow label="Created" value={formatDate(properties.createdAt)} />
              )}
              {properties.updatedAt && (
                <MetaRow label="Last edited" value={formatDate(properties.updatedAt)} />
              )}
              {properties.wordCount !== undefined && (
                <MetaRow label="Word count" value={`${properties.wordCount.toLocaleString()} words`} />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────

function PropLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[#9096a2]">{icon}</span>
      <span className="text-[11px] font-semibold text-[#9096a2] uppercase tracking-wider">{label}</span>
    </div>
  );
}

function Separator() {
  return <div className="border-t border-[#f0f1f3]" />;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-[#9096a2]">{label}</span>
      <span className="text-[12px] text-[#4a4f5c]">{value}</span>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}
