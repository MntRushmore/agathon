'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  Table, Kanban, Plus, Trash, X, Check, PencilSimple,
  DotsThreeVertical, ArrowUp, ArrowDown, TextT, Hash,
  CalendarBlank, CheckSquare, Tag, Link as LinkIcon,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────

export type ColumnType = 'text' | 'number' | 'select' | 'checkbox' | 'date' | 'url';
export type ViewType = 'table' | 'kanban';

export interface SelectOption {
  id: string;
  label: string;
  color: string;
}

export interface DatabaseColumn {
  id: string;
  name: string;
  type: ColumnType;
  options?: SelectOption[]; // for select type
  width?: number;
}

export interface DatabaseRow {
  id: string;
  cells: Record<string, string | number | boolean | null>;
}

export interface DatabaseConfig {
  title: string;
  view: ViewType;
  columns: DatabaseColumn[];
  rows: DatabaseRow[];
  kanbanColumnId?: string; // which column to group by in kanban
}

export const DEFAULT_DATABASE_CONFIG: DatabaseConfig = {
  title: 'Untitled database',
  view: 'table',
  columns: [
    { id: 'col-name', name: 'Name', type: 'text', width: 200 },
    { id: 'col-status', name: 'Status', type: 'select', width: 140, options: [
      { id: 'opt-todo', label: 'To do', color: '#9096a2' },
      { id: 'opt-progress', label: 'In progress', color: '#007ba5' },
      { id: 'opt-done', label: 'Done', color: '#16a34a' },
    ]},
    { id: 'col-notes', name: 'Notes', type: 'text', width: 200 },
  ],
  rows: [
    { id: 'row-1', cells: { 'col-name': '', 'col-status': null, 'col-notes': '' } },
    { id: 'row-2', cells: { 'col-name': '', 'col-status': null, 'col-notes': '' } },
    { id: 'row-3', cells: { 'col-name': '', 'col-status': null, 'col-notes': '' } },
  ],
  kanbanColumnId: 'col-status',
};

// ── Serialization ──────────────────────────────────────────

export function encodeDatabaseData(config: DatabaseConfig): string {
  return encodeURIComponent(JSON.stringify(config));
}

export function decodeDatabaseData(encoded: string): DatabaseConfig {
  try {
    return JSON.parse(decodeURIComponent(encoded));
  } catch {
    return DEFAULT_DATABASE_CONFIG;
  }
}

// ── Helpers ────────────────────────────────────────────────

const SELECT_COLORS = [
  '#9096a2', '#007ba5', '#16a34a', '#dc2626', '#d97706',
  '#7c3aed', '#db2777', '#0891b2', '#65a30d', '#ea580c',
];

function genId() {
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function ColumnTypeIcon({ type, className }: { type: ColumnType; className?: string }) {
  const cls = cn('h-3.5 w-3.5 flex-shrink-0', className);
  switch (type) {
    case 'number': return <Hash className={cls} />;
    case 'select': return <Tag className={cls} />;
    case 'checkbox': return <CheckSquare className={cls} />;
    case 'date': return <CalendarBlank className={cls} />;
    case 'url': return <LinkIcon className={cls} />;
    default: return <TextT className={cls} />;
  }
}

// ── Cell renderer ──────────────────────────────────────────

function Cell({
  value,
  column,
  isEditing,
  onEdit,
  onSave,
}: {
  value: string | number | boolean | null;
  column: DatabaseColumn;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (val: string | number | boolean | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (typeof value === 'string') inputRef.current.select();
    }
  }, [isEditing, value]);

  if (column.type === 'checkbox') {
    return (
      <div className="flex items-center justify-center h-full px-2">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onSave(e.target.checked)}
          className="w-4 h-4 rounded border-[#d1d5db] accent-[#007ba5] cursor-pointer"
        />
      </div>
    );
  }

  if (column.type === 'select') {
    const option = column.options?.find((o) => o.id === value);
    if (!isEditing) {
      return (
        <div className="flex items-center h-full px-2 cursor-pointer" onClick={onEdit}>
          {option ? (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
              style={{ backgroundColor: option.color }}
            >
              {option.label}
            </span>
          ) : (
            <span className="text-[#c4c7cd] text-[13px]">—</span>
          )}
        </div>
      );
    }
    return (
      <div className="absolute z-20 bg-white border border-[#e2e4e8] rounded-lg shadow-xl py-1 min-w-[160px] top-0 left-0">
        {column.options?.map((opt) => (
          <button
            key={opt.id}
            className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#f5f6f8] text-left"
            onClick={() => { onSave(opt.id); }}
          >
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-white"
              style={{ backgroundColor: opt.color }}
            >
              {opt.label}
            </span>
          </button>
        ))}
        <button
          className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#f5f6f8] text-left text-[12px] text-[#9096a2]"
          onClick={() => { onSave(null); }}
        >
          Clear
        </button>
      </div>
    );
  }

  if (!isEditing) {
    return (
      <div
        className="flex items-center h-full px-2 cursor-text text-[13px] text-[#1a1d2b] truncate"
        onClick={onEdit}
      >
        {value !== null && value !== '' ? String(value) : (
          <span className="text-[#c4c7cd]" />
        )}
      </div>
    );
  }

  return (
    <input
      ref={inputRef}
      type={column.type === 'number' ? 'number' : column.type === 'date' ? 'date' : 'text'}
      value={value === null ? '' : String(value)}
      onChange={(e) => onSave(column.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
      onBlur={() => onSave(value)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') { (e.target as HTMLInputElement).blur(); } }}
      className="w-full h-full px-2 text-[13px] bg-transparent border-none outline-none focus:ring-0"
    />
  );
}

// ── Table View ─────────────────────────────────────────────

function TableView({
  columns,
  rows,
  onUpdateCell,
  onAddRow,
  onDeleteRow,
  onAddColumn,
  onDeleteColumn,
  onRenameColumn,
  onMoveColumn,
}: {
  columns: DatabaseColumn[];
  rows: DatabaseRow[];
  onUpdateCell: (rowId: string, colId: string, val: string | number | boolean | null) => void;
  onAddRow: () => void;
  onDeleteRow: (rowId: string) => void;
  onAddColumn: () => void;
  onDeleteColumn: (colId: string) => void;
  onRenameColumn: (colId: string, name: string) => void;
  onMoveColumn: (colId: string, dir: 'left' | 'right') => void;
}) {
  const [editingCell, setEditingCell] = useState<{ rowId: string; colId: string } | null>(null);
  const [editingColId, setEditingColId] = useState<string | null>(null);
  const [colMenuId, setColMenuId] = useState<string | null>(null);
  const [hoverRowId, setHoverRowId] = useState<string | null>(null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left" style={{ tableLayout: 'fixed' }}>
        <colgroup>
          {columns.map((col) => (
            <col key={col.id} style={{ width: col.width ?? 160 }} />
          ))}
          <col style={{ width: 36 }} />
          <col style={{ width: 36 }} />
        </colgroup>
        <thead>
          <tr className="border-b border-[#e2e4e8]">
            {columns.map((col, idx) => (
              <th key={col.id} className="relative group/col h-9 font-normal border-r border-[#e2e4e8] last-of-type:border-r-0">
                <div className="flex items-center gap-1.5 px-2 h-full">
                  <ColumnTypeIcon type={col.type} className="text-[#9096a2]" />
                  {editingColId === col.id ? (
                    <input
                      autoFocus
                      defaultValue={col.name}
                      onBlur={(e) => { onRenameColumn(col.id, e.target.value || col.name); setEditingColId(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditingColId(null); }}
                      className="flex-1 bg-transparent border-none outline-none text-[13px] font-medium text-[#1a1d2b] focus:ring-0 min-w-0"
                    />
                  ) : (
                    <span
                      className="flex-1 text-[13px] font-medium text-[#1a1d2b] truncate cursor-pointer select-none"
                      onDoubleClick={() => setEditingColId(col.id)}
                    >
                      {col.name}
                    </span>
                  )}
                  <button
                    className="opacity-0 group-hover/col:opacity-100 p-0.5 rounded hover:bg-[#f0f1f3] text-[#9096a2] transition-opacity"
                    onClick={() => setColMenuId(colMenuId === col.id ? null : col.id)}
                  >
                    <DotsThreeVertical className="h-3.5 w-3.5" weight="bold" />
                  </button>
                </div>
                {colMenuId === col.id && (
                  <div className="absolute right-0 top-full z-30 bg-white border border-[#e2e4e8] rounded-lg shadow-xl py-1 min-w-[140px]">
                    <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#f5f6f8] text-[13px] text-[#4a4f5c]" onClick={() => { setEditingColId(col.id); setColMenuId(null); }}>
                      <PencilSimple className="h-3.5 w-3.5" /> Rename
                    </button>
                    {idx > 0 && (
                      <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#f5f6f8] text-[13px] text-[#4a4f5c]" onClick={() => { onMoveColumn(col.id, 'left'); setColMenuId(null); }}>
                        <ArrowUp className="h-3.5 w-3.5 rotate-[-90deg]" /> Move left
                      </button>
                    )}
                    {idx < columns.length - 1 && (
                      <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#f5f6f8] text-[13px] text-[#4a4f5c]" onClick={() => { onMoveColumn(col.id, 'right'); setColMenuId(null); }}>
                        <ArrowDown className="h-3.5 w-3.5 rotate-[-90deg]" /> Move right
                      </button>
                    )}
                    <div className="h-px bg-[#e2e4e8] my-1" />
                    <button className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-[#fff0f0] text-[13px] text-red-600" onClick={() => { onDeleteColumn(col.id); setColMenuId(null); }}>
                      <Trash className="h-3.5 w-3.5" /> Delete column
                    </button>
                  </div>
                )}
              </th>
            ))}
            {/* Add column */}
            <th className="h-9 border-r-0">
              <button
                onClick={onAddColumn}
                className="flex items-center justify-center w-full h-full text-[#9096a2] hover:text-[#4a4f5c] hover:bg-[#f5f6f8] transition-colors"
                title="Add column"
              >
                <Plus className="h-4 w-4" />
              </button>
            </th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-[#f0f1f3] group/row hover:bg-[#fafafa] transition-colors"
              onMouseEnter={() => setHoverRowId(row.id)}
              onMouseLeave={() => setHoverRowId(null)}
            >
              {columns.map((col) => (
                <td
                  key={col.id}
                  className="relative h-9 border-r border-[#f0f1f3] last-of-type:border-r-0"
                  style={editingCell?.rowId === row.id && editingCell?.colId === col.id && col.type === 'select' ? { overflow: 'visible' } : {}}
                >
                  <Cell
                    value={row.cells[col.id] ?? null}
                    column={col}
                    isEditing={editingCell?.rowId === row.id && editingCell?.colId === col.id}
                    onEdit={() => setEditingCell({ rowId: row.id, colId: col.id })}
                    onSave={(val) => {
                      onUpdateCell(row.id, col.id, val);
                      if (col.type !== 'checkbox') setEditingCell(null);
                    }}
                  />
                </td>
              ))}
              {/* Spacer */}
              <td />
              {/* Row delete */}
              <td className="text-center">
                <button
                  onClick={() => onDeleteRow(row.id)}
                  className={cn('p-1 rounded text-[#c4c7cd] hover:text-red-500 hover:bg-[#fff0f0] transition-colors', hoverRowId === row.id ? 'opacity-100' : 'opacity-0')}
                  title="Delete row"
                >
                  <X className="h-3 w-3" />
                </button>
              </td>
            </tr>
          ))}
          {/* Add row */}
          <tr>
            <td colSpan={columns.length + 2} className="h-9">
              <button
                onClick={onAddRow}
                className="flex items-center gap-1.5 px-3 h-full text-[13px] text-[#9096a2] hover:text-[#4a4f5c] hover:bg-[#f5f6f8] transition-colors w-full"
              >
                <Plus className="h-3.5 w-3.5" />
                New row
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Kanban View ────────────────────────────────────────────

function KanbanView({
  columns,
  rows,
  kanbanColumnId,
  onUpdateCell,
  onAddRow,
  onDeleteRow,
}: {
  columns: DatabaseColumn[];
  rows: DatabaseRow[];
  kanbanColumnId: string;
  onUpdateCell: (rowId: string, colId: string, val: string | number | boolean | null) => void;
  onAddRow: () => void;
  onDeleteRow: (rowId: string) => void;
}) {
  const kanbanCol = columns.find((c) => c.id === kanbanColumnId);
  const nameCol = columns.find((c) => c.type === 'text') ?? columns[0];

  // Group rows by option id
  const groups: { optionId: string | null; label: string; color: string; rows: DatabaseRow[] }[] = [];

  if (kanbanCol?.type === 'select' && kanbanCol.options) {
    // One lane per option
    for (const opt of kanbanCol.options) {
      groups.push({
        optionId: opt.id,
        label: opt.label,
        color: opt.color,
        rows: rows.filter((r) => r.cells[kanbanColumnId] === opt.id),
      });
    }
    // Unassigned lane
    const unassigned = rows.filter((r) => !r.cells[kanbanColumnId]);
    if (unassigned.length > 0) {
      groups.unshift({ optionId: null, label: 'No status', color: '#c4c7cd', rows: unassigned });
    }
  } else {
    groups.push({ optionId: null, label: 'All', color: '#007ba5', rows });
  }

  return (
    <div className="flex gap-3 p-3 overflow-x-auto min-h-[200px]">
      {groups.map((group) => (
        <div
          key={group.optionId ?? 'unassigned'}
          className="flex flex-col gap-2 flex-shrink-0 w-[220px]"
        >
          {/* Lane header */}
          <div className="flex items-center gap-2 px-1">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: group.color }}
            />
            <span className="text-[12px] font-semibold text-[#4a4f5c] flex-1 truncate">{group.label}</span>
            <span className="text-[11px] text-[#9096a2]">{group.rows.length}</span>
          </div>

          {/* Cards */}
          {group.rows.map((row) => (
            <div
              key={row.id}
              className="group/card bg-white border border-[#e2e4e8] rounded-xl p-3 shadow-sm hover:shadow-md hover:border-[#007ba5]/30 transition-all cursor-default"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-medium text-[#1a1d2b] leading-snug flex-1 min-w-0 break-words">
                  {String(row.cells[nameCol?.id ?? ''] || '—')}
                </p>
                <button
                  onClick={() => onDeleteRow(row.id)}
                  className="opacity-0 group-hover/card:opacity-100 flex-shrink-0 p-0.5 rounded text-[#c4c7cd] hover:text-red-500 transition-all"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              {/* Show other non-name, non-status columns */}
              {columns
                .filter((c) => c.id !== nameCol?.id && c.id !== kanbanColumnId)
                .map((col) => {
                  const val = row.cells[col.id];
                  if (val === null || val === '' || val === undefined) return null;
                  return (
                    <div key={col.id} className="mt-1.5 flex items-center gap-1">
                      <ColumnTypeIcon type={col.type} className="text-[#9096a2]" />
                      <span className="text-[11px] text-[#9096a2] truncate">{String(val)}</span>
                    </div>
                  );
                })}
            </div>
          ))}

          {/* Add card */}
          <button
            onClick={() => {
              onAddRow();
              // After adding, set the new row's kanban column to this group's option
              // We'll handle this by updating cell after add
            }}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[12px] text-[#9096a2] hover:text-[#4a4f5c] hover:bg-[#f5f6f8] transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Add card
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────

interface InlineDatabaseProps {
  id: string;
  initialData: DatabaseConfig;
  onSave: (id: string, data: DatabaseConfig) => void;
  onDelete: (id: string) => void;
}

export function InlineDatabase({ id, initialData, onSave, onDelete }: InlineDatabaseProps) {
  const [config, setConfig] = useState<DatabaseConfig>(initialData);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const updateAndSave = useCallback((updater: (prev: DatabaseConfig) => DatabaseConfig) => {
    setConfig((prev) => {
      const next = updater(prev);
      onSave(id, next);
      return next;
    });
  }, [id, onSave]);

  // ── Cell ──
  const handleUpdateCell = useCallback((rowId: string, colId: string, val: string | number | boolean | null) => {
    updateAndSave((prev) => ({
      ...prev,
      rows: prev.rows.map((r) => r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: val } } : r),
    }));
  }, [updateAndSave]);

  // ── Rows ──
  const handleAddRow = useCallback(() => {
    const newRow: DatabaseRow = {
      id: genId(),
      cells: Object.fromEntries(config.columns.map((c) => [c.id, c.type === 'checkbox' ? false : null])),
    };
    updateAndSave((prev) => ({ ...prev, rows: [...prev.rows, newRow] }));
  }, [config.columns, updateAndSave]);

  const handleDeleteRow = useCallback((rowId: string) => {
    updateAndSave((prev) => ({ ...prev, rows: prev.rows.filter((r) => r.id !== rowId) }));
  }, [updateAndSave]);

  // ── Columns ──
  const handleAddColumn = useCallback(() => {
    const col: DatabaseColumn = { id: genId(), name: 'New column', type: 'text', width: 160 };
    updateAndSave((prev) => ({
      ...prev,
      columns: [...prev.columns, col],
      rows: prev.rows.map((r) => ({ ...r, cells: { ...r.cells, [col.id]: null } })),
    }));
  }, [updateAndSave]);

  const handleDeleteColumn = useCallback((colId: string) => {
    updateAndSave((prev) => ({
      ...prev,
      columns: prev.columns.filter((c) => c.id !== colId),
      rows: prev.rows.map((r) => {
        const cells = { ...r.cells };
        delete cells[colId];
        return { ...r, cells };
      }),
    }));
  }, [updateAndSave]);

  const handleRenameColumn = useCallback((colId: string, name: string) => {
    updateAndSave((prev) => ({
      ...prev,
      columns: prev.columns.map((c) => c.id === colId ? { ...c, name } : c),
    }));
  }, [updateAndSave]);

  const handleMoveColumn = useCallback((colId: string, dir: 'left' | 'right') => {
    updateAndSave((prev) => {
      const cols = [...prev.columns];
      const idx = cols.findIndex((c) => c.id === colId);
      if (idx < 0) return prev;
      const target = dir === 'left' ? idx - 1 : idx + 1;
      if (target < 0 || target >= cols.length) return prev;
      [cols[idx], cols[target]] = [cols[target], cols[idx]];
      return { ...prev, columns: cols };
    });
  }, [updateAndSave]);

  const setView = (view: ViewType) => updateAndSave((prev) => ({ ...prev, view }));

  return (
    <div className="my-4 border border-[#e2e4e8] rounded-2xl overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#e2e4e8] bg-[#fafafa]">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isEditingTitle ? (
            <input
              autoFocus
              value={config.title}
              onChange={(e) => setConfig((p) => ({ ...p, title: e.target.value }))}
              onBlur={() => { setIsEditingTitle(false); onSave(id, config); }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setIsEditingTitle(false); }}
              className="flex-1 bg-white border border-[#007ba5]/40 rounded-lg px-2 py-0.5 text-sm font-semibold text-[#1a1d2b] outline-none focus:ring-2 focus:ring-[#007ba5]/20 min-w-0"
            />
          ) : (
            <button
              className="text-sm font-semibold text-[#1a1d2b] hover:text-[#007ba5] transition-colors truncate text-left"
              onDoubleClick={() => setIsEditingTitle(true)}
              title="Double-click to rename"
            >
              {config.title}
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* View switcher */}
          <div className="flex items-center gap-0.5 bg-[#f0f1f3] rounded-lg p-0.5">
            <button
              onClick={() => setView('table')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors',
                config.view === 'table'
                  ? 'bg-white text-[#1a1d2b] shadow-sm'
                  : 'text-[#9096a2] hover:text-[#4a4f5c]'
              )}
            >
              <Table className="h-3.5 w-3.5" />
              Table
            </button>
            <button
              onClick={() => setView('kanban')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium transition-colors',
                config.view === 'kanban'
                  ? 'bg-white text-[#1a1d2b] shadow-sm'
                  : 'text-[#9096a2] hover:text-[#4a4f5c]'
              )}
            >
              <Kanban className="h-3.5 w-3.5" />
              Board
            </button>
          </div>

          {/* Delete */}
          {showDeleteConfirm ? (
            <div className="flex items-center gap-1">
              <button onClick={() => onDelete(id)} className="flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded-lg text-[11px] font-medium hover:bg-red-700 transition-colors">
                <Check className="h-3 w-3" /> Delete
              </button>
              <button onClick={() => setShowDeleteConfirm(false)} className="px-2 py-1 text-[#9096a2] hover:text-[#4a4f5c] text-[11px] transition-colors">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 rounded-lg text-[#c4c7cd] hover:text-red-500 hover:bg-[#fff0f0] transition-colors"
              title="Delete database"
            >
              <Trash className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {config.view === 'table' ? (
        <TableView
          columns={config.columns}
          rows={config.rows}
          onUpdateCell={handleUpdateCell}
          onAddRow={handleAddRow}
          onDeleteRow={handleDeleteRow}
          onAddColumn={handleAddColumn}
          onDeleteColumn={handleDeleteColumn}
          onRenameColumn={handleRenameColumn}
          onMoveColumn={handleMoveColumn}
        />
      ) : (
        <KanbanView
          columns={config.columns}
          rows={config.rows}
          kanbanColumnId={config.kanbanColumnId ?? config.columns.find((c) => c.type === 'select')?.id ?? config.columns[0].id}
          onUpdateCell={handleUpdateCell}
          onAddRow={handleAddRow}
          onDeleteRow={handleDeleteRow}
        />
      )}
    </div>
  );
}
