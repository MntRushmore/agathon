'use client';

import { useState, useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Check, Trash, ChartBar, ChartLineUp, Plus, X, DotsSixVertical, PencilSimple } from '@phosphor-icons/react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────

export interface ChartDataPoint {
  x: string;
  y: number;
}

export interface ChartSeries {
  name: string;
  data: ChartDataPoint[];
}

export interface ChartConfig {
  title: string;
  subtitle: string;
  chartType: 'bar' | 'line' | 'scatter';
  xAxisTitle: string;
  yAxisTitle: string;
  series: ChartSeries[];
}

export const DEFAULT_CHART_DATA: ChartConfig = {
  title: 'Chart Title',
  subtitle: '',
  chartType: 'bar',
  xAxisTitle: 'X Axis',
  yAxisTitle: 'Y Axis',
  series: [
    {
      name: 'Series 1',
      data: [
        { x: 'Jan', y: 20 },
        { x: 'Feb', y: 14 },
        { x: 'Mar', y: 23 },
        { x: 'Apr', y: 25 },
        { x: 'May', y: 22 },
      ],
    },
  ],
};

// ── Serialization ──────────────────────────────────────────

export function encodeChartData(config: ChartConfig): string {
  return encodeURIComponent(JSON.stringify(config));
}

export function decodeChartData(encoded: string): ChartConfig {
  try {
    return JSON.parse(decodeURIComponent(encoded));
  } catch {
    return DEFAULT_CHART_DATA;
  }
}

// ── Color palette ──────────────────────────────────────────

const SERIES_COLORS = ['#6B8E5B', '#1A6B8A', '#C17A3A', '#8B5A8B', '#C15A5A'];

// ── Component ──────────────────────────────────────────────

interface InlineChartProps {
  id: string;
  initialData: ChartConfig;
  onSave: (id: string, data: ChartConfig) => void;
  onDelete: (id: string) => void;
}

export function InlineChart({ id, initialData, onSave, onDelete }: InlineChartProps) {
  const [title, setTitle] = useState(initialData.title);
  const [subtitle, setSubtitle] = useState(initialData.subtitle);
  const [chartType, setChartType] = useState(initialData.chartType);
  const [xAxisTitle, setXAxisTitle] = useState(initialData.xAxisTitle);
  const [yAxisTitle, setYAxisTitle] = useState(initialData.yAxisTitle);
  const [series, setSeries] = useState<ChartSeries[]>(initialData.series);
  const [isEditing, setIsEditing] = useState(false);

  // Build the current config object
  const currentConfig: ChartConfig = useMemo(() => ({
    title, subtitle, chartType, xAxisTitle, yAxisTitle, series,
  }), [title, subtitle, chartType, xAxisTitle, yAxisTitle, series]);

  // Transform series data into Recharts format (merge by x-value)
  const rechartsData = useMemo(() => {
    const dataMap = new Map<string, Record<string, string | number>>();
    series.forEach((s) => {
      s.data.forEach((d) => {
        const existing = dataMap.get(d.x) || { x: d.x };
        existing[s.name] = d.y;
        dataMap.set(d.x, existing);
      });
    });
    return Array.from(dataMap.values());
  }, [series]);

  const handleSave = () => {
    setIsEditing(false);
    onSave(id, currentConfig);
  };

  // ── Series helpers ──

  const updateSeriesName = (idx: number, name: string) => {
    setSeries(prev => prev.map((s, i) => i === idx ? { ...s, name } : s));
  };

  const addDataPoint = (seriesIdx: number) => {
    setSeries(prev => prev.map((s, i) =>
      i === seriesIdx ? { ...s, data: [...s.data, { x: '', y: 0 }] } : s
    ));
  };

  const removeDataPoint = (seriesIdx: number, pointIdx: number) => {
    setSeries(prev => prev.map((s, i) =>
      i === seriesIdx ? { ...s, data: s.data.filter((_, j) => j !== pointIdx) } : s
    ));
  };

  const updateDataPoint = (seriesIdx: number, pointIdx: number, field: 'x' | 'y', value: string) => {
    setSeries(prev => prev.map((s, i) =>
      i === seriesIdx
        ? {
            ...s,
            data: s.data.map((d, j) =>
              j === pointIdx
                ? { ...d, [field]: field === 'y' ? (parseFloat(value) || 0) : value }
                : d
            ),
          }
        : s
    ));
  };

  const addSeries = () => {
    setSeries(prev => [...prev, {
      name: `Series ${prev.length + 1}`,
      data: [{ x: '', y: 0 }],
    }]);
  };

  const removeSeries = (idx: number) => {
    if (series.length <= 1) return;
    setSeries(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Input style ──
  const inputClass = 'w-full px-3 py-2 border border-[#CFC0A8] bg-[#F6F4EC] text-[#3A2E1E] text-sm rounded-lg placeholder:text-[#9B8B78] focus:outline-none focus:ring-2 focus:ring-[#1A6B8A]/30 focus:border-[#1A6B8A] transition-colors';

  // ── Render chart ──
  const renderChart = () => {
    const chartProps = {
      data: rechartsData,
      margin: { top: 10, right: 20, left: 10, bottom: 5 },
    };

    const axisProps = {
      xAxis: <XAxis dataKey="x" tick={{ fontSize: 12, fill: '#5C4B3A' }} />,
      yAxis: <YAxis tick={{ fontSize: 12, fill: '#5C4B3A' }} />,
      grid: <CartesianGrid strokeDasharray="3 3" stroke="#CFC0A8" opacity={0.5} />,
      tooltip: <Tooltip
        contentStyle={{
          backgroundColor: '#F6F4EC',
          border: '1px solid #CFC0A8',
          borderRadius: 8,
          fontSize: 12,
        }}
      />,
    };

    if (chartType === 'line') {
      return (
        <LineChart {...chartProps}>
          {axisProps.grid}
          {axisProps.xAxis}
          {axisProps.yAxis}
          {axisProps.tooltip}
          {series.map((s, i) => (
            <Line
              key={s.name}
              type="monotone"
              dataKey={s.name}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          ))}
        </LineChart>
      );
    }

    if (chartType === 'scatter') {
      return (
        <ScatterChart margin={chartProps.margin}>
          {axisProps.grid}
          <XAxis dataKey="x" type="number" tick={{ fontSize: 12, fill: '#5C4B3A' }} name={xAxisTitle} />
          {axisProps.yAxis}
          {axisProps.tooltip}
          {series.map((s, i) => (
            <Scatter
              key={s.name}
              name={s.name}
              data={s.data.map(d => ({ x: parseFloat(d.x) || 0, y: d.y }))}
              fill={SERIES_COLORS[i % SERIES_COLORS.length]}
            />
          ))}
        </ScatterChart>
      );
    }

    // Default: bar
    return (
      <BarChart {...chartProps}>
        {axisProps.grid}
        {axisProps.xAxis}
        {axisProps.yAxis}
        {axisProps.tooltip}
        {series.map((s, i) => (
          <Bar
            key={s.name}
            dataKey={s.name}
            fill={SERIES_COLORS[i % SERIES_COLORS.length]}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    );
  };

  return (
    <div>
      {/* Chart card */}
      <div className="rounded-xl border border-[#CFC0A8] overflow-hidden bg-[#F6F4EC]">
        {/* Title area */}
        <div className="px-5 pt-4 pb-1">
          {title && (
            <h3 className="text-lg font-semibold text-[#3A2E1E]">{title}</h3>
          )}
          {subtitle && (
            <p className="text-sm text-[#5C4B3A] mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Chart */}
        <div className="px-2 pb-2">
          <div className="flex items-center">
            {yAxisTitle && (
              <div className="flex-shrink-0 -mr-2">
                <span
                  className="block text-xs text-[#9B8B78] font-medium"
                  style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                >
                  {yAxisTitle}
                </span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <ResponsiveContainer width="100%" height={280}>
                {renderChart()}
              </ResponsiveContainer>
            </div>
          </div>
          {xAxisTitle && (
            <p className="text-xs text-[#9B8B78] font-medium text-center mt-1">{xAxisTitle}</p>
          )}
        </div>

        {/* Inline editor */}
        {isEditing && (
          <div className="border-t border-[#CFC0A8] bg-[#EDE3CC] p-4 space-y-4">
            {/* Title & Subtitle */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#5C4B3A] mb-1 block">Chart Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Chart Title"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4B3A] mb-1 block">Subtitle (optional)</label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="Enter subtitle..."
                  className={inputClass}
                />
              </div>
            </div>

            {/* Chart Type */}
            <div>
              <label className="text-xs font-medium text-[#5C4B3A] mb-2 block">Chart Type</label>
              <div className="flex gap-2">
                {([
                  { type: 'bar' as const, icon: ChartBar, label: 'Bar' },
                  { type: 'line' as const, icon: ChartLineUp, label: 'Line' },
                  { type: 'scatter' as const, icon: DotsSixVertical, label: 'Scatter' },
                ]).map(({ type, icon: Icon, label }) => (
                  <button
                    key={type}
                    onClick={() => setChartType(type)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition-colors',
                      chartType === type
                        ? 'bg-[#1A6B8A] text-white border-[#1A6B8A]'
                        : 'bg-[#F6F4EC] text-[#5C4B3A] border-[#CFC0A8] hover:bg-[#E8DCC0]'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Axis Titles */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-[#5C4B3A] mb-1 block">X Axis Title</label>
                <input
                  type="text"
                  value={xAxisTitle}
                  onChange={(e) => setXAxisTitle(e.target.value)}
                  placeholder="X Axis"
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-[#5C4B3A] mb-1 block">Y Axis Title</label>
                <input
                  type="text"
                  value={yAxisTitle}
                  onChange={(e) => setYAxisTitle(e.target.value)}
                  placeholder="Y Axis"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Data Series */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[#5C4B3A]">Data Series</label>
                <button
                  onClick={addSeries}
                  className="flex items-center gap-1 text-xs font-medium text-[#1A6B8A] hover:text-[#145A73] bg-[#1A6B8A]/10 hover:bg-[#1A6B8A]/20 px-2.5 py-1 rounded-md transition-colors"
                >
                  <Plus className="h-3 w-3" weight="bold" />
                  Add Series
                </button>
              </div>

              <div className="space-y-3">
                {series.map((s, sIdx) => (
                  <div key={sIdx} className="border border-[#CFC0A8] rounded-lg bg-[#F6F4EC] p-3">
                    {/* Series header */}
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="text"
                        value={s.name}
                        onChange={(e) => updateSeriesName(sIdx, e.target.value)}
                        className="flex-1 px-2 py-1 border border-[#CFC0A8] bg-white text-[#3A2E1E] text-sm font-medium rounded focus:outline-none focus:ring-1 focus:ring-[#1A6B8A]/30"
                      />
                      {series.length > 1 && (
                        <button
                          onClick={() => removeSeries(sIdx)}
                          className="p-1 text-[#9B8B78] hover:text-red-600 transition-colors"
                          title="Remove series"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Column headers */}
                    <div className="grid grid-cols-[1fr_1fr_28px] gap-2 mb-1">
                      <span className="text-[10px] uppercase tracking-wider text-[#9B8B78] font-medium px-1">X Value</span>
                      <span className="text-[10px] uppercase tracking-wider text-[#9B8B78] font-medium px-1">Y Value</span>
                      <span />
                    </div>

                    {/* Data rows */}
                    <div className="space-y-1.5">
                      {s.data.map((d, dIdx) => (
                        <div key={dIdx} className="grid grid-cols-[1fr_1fr_28px] gap-2 items-center">
                          <input
                            type="text"
                            value={d.x}
                            onChange={(e) => updateDataPoint(sIdx, dIdx, 'x', e.target.value)}
                            placeholder="Label"
                            className="px-2 py-1.5 border border-[#CFC0A8] bg-white text-[#3A2E1E] text-sm rounded focus:outline-none focus:ring-1 focus:ring-[#1A6B8A]/30"
                          />
                          <input
                            type="number"
                            value={d.y}
                            onChange={(e) => updateDataPoint(sIdx, dIdx, 'y', e.target.value)}
                            placeholder="0"
                            className="px-2 py-1.5 border border-[#CFC0A8] bg-white text-[#3A2E1E] text-sm rounded focus:outline-none focus:ring-1 focus:ring-[#1A6B8A]/30"
                          />
                          <button
                            onClick={() => removeDataPoint(sIdx, dIdx)}
                            className="p-1 text-[#9B8B78] hover:text-red-600 transition-colors flex-shrink-0"
                            title="Remove row"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add row */}
                    <button
                      onClick={() => addDataPoint(sIdx)}
                      className="flex items-center gap-1 text-xs text-[#1A6B8A] hover:text-[#145A73] mt-2 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                      Add row
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom toolbar pill */}
      <div className="flex items-center justify-center mt-2">
        <div className="flex items-center gap-1 bg-[#F7F0E3] rounded-full shadow-md border border-[#CFC0A8] px-1.5 py-1">
          {isEditing ? (
            <button
              onClick={handleSave}
              className="p-1.5 rounded-full bg-[#6B8E5B] text-white hover:bg-[#5A7A4A] transition-colors"
              title="Save chart"
            >
              <Check className="h-3.5 w-3.5" weight="bold" />
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 rounded-full text-[#5C4B3A] hover:bg-[#E8DCC0] transition-colors"
              title="Edit chart"
            >
              <PencilSimple className="h-3.5 w-3.5" />
            </button>
          )}
          <div className="flex items-center gap-1 px-2 text-xs text-[#5C4B3A] font-medium">
            <ChartBar className="h-3.5 w-3.5" />
            {chartType.charAt(0).toUpperCase() + chartType.slice(1)}
          </div>
          <button
            onClick={() => onDelete(id)}
            className="p-1.5 rounded-full text-[#9B8B78] hover:text-red-600 hover:bg-red-50 transition-colors"
            title="Delete chart"
          >
            <Trash className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
