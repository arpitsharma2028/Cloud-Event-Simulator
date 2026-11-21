import React, { useState } from 'react';

export default function TelemetryChart({
  data = [],
  title = "Telemetry Timeseries",
  series = [
    { key: 'cpu_util', label: 'CPU Util %', color: '#3b82f6' },
    { key: 'mem_util', label: 'Mem Util %', color: '#10b981' }
  ],
  unit = "%",
  height = 220,
  totalDuration = null,
  dualAxis = false,
  referenceLines = []
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="card" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No telemetry points recorded yet.
      </div>
    );
  }

  const padding = { top: 20, right: dualAxis ? 50 : 30, bottom: 30, left: 45 };
  const width = 650;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // X range (timestamp) fixed to totalDuration when provided to prevent horizontal stretch/wobble
  const xMin = 0;
  const xMax = totalDuration && totalDuration > 0
    ? totalDuration
    : Math.max(data[data.length - 1]?.timestamp || 1, xMin + 0.1);

  // Y range calculations
  let yMinLeft = 0;
  let yMaxLeft = 100;
  let yMinRight = 0;
  let yMaxRight = 100;

  if (dualAxis && series.length >= 2) {
    // Left axis (series[0])
    let maxFound0 = 0;
    data.forEach(d => {
      const val = d[series[0].key];
      if (val !== undefined && val > maxFound0) maxFound0 = val;
    });
    yMaxLeft = Math.max(4, Math.ceil(maxFound0 * 1.25));

    // Right axis (series[1])
    let maxFound1 = 0;
    data.forEach(d => {
      const val = d[series[1].key];
      if (val !== undefined && val > maxFound1) maxFound1 = val;
    });
    yMaxRight = Math.max(10, Math.ceil(maxFound1 * 1.2));
  } else {
    // Single shared Y-axis
    if (unit !== '%') {
      let maxFound = 0;
      data.forEach(d => {
        series.forEach(s => {
          if (d[s.key] !== undefined && d[s.key] > maxFound) {
            maxFound = d[s.key];
          }
        });
      });
      yMaxLeft = Math.max(10, Math.ceil(maxFound * 1.15));
    }
  }

  const getX = (t) => padding.left + ((t - xMin) / (xMax - xMin)) * chartWidth;
  const getYLeft = (val) => padding.top + chartHeight - ((val - yMinLeft) / (yMaxLeft - yMinLeft)) * chartHeight;
  const getYRight = (val) => padding.top + chartHeight - ((val - yMinRight) / (yMaxRight - yMinRight)) * chartHeight;

  const getYForSeries = (sIdx, val) => {
    if (dualAxis && sIdx === 1) return getYRight(val);
    return getYLeft(val);
  };

  // Generate SVG path strings
  const paths = series.map((s, sIdx) => {
    const points = data.map(d => {
      const x = getX(d.timestamp || 0);
      const val = d[s.key] !== undefined ? d[s.key] : 0;
      const y = getYForSeries(sIdx, val);
      return `${x},${y}`;
    });
    return {
      ...s,
      pathStr: points.length > 0 ? `M ${points.join(' L ')}` : ''
    };
  });

  return (
    <div className="card" style={{ padding: '14px 16px', position: 'relative' }}>
      {/* Header & Inline Legend Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', letterSpacing: '0.02em' }}>
          {title}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', flexWrap: 'wrap' }}>
          {series.map(s => (
            <div key={s.key} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(15, 23, 42, 0.65)',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid rgba(51, 70, 109, 0.5)'
            }}>
              <span style={{ width: 8, height: 8, backgroundColor: s.color, display: 'inline-block', borderRadius: '50%' }}></span>
              <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SVG Chart */}
      <div style={{ width: '100%', overflowX: 'hidden' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* Horizontal Gridlines & Y-Axis Labels */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((ratio, i) => {
            const yPos = padding.top + chartHeight - ratio * chartHeight;
            const leftVal = Math.round(yMinLeft + ratio * (yMaxLeft - yMinLeft));
            const rightVal = Math.round(yMinRight + ratio * (yMaxRight - yMinRight));

            return (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={yPos}
                  x2={padding.left + chartWidth}
                  y2={yPos}
                  stroke="#1f2c47"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />
                {/* Left Axis Label */}
                <text
                  x={padding.left - 6}
                  y={yPos + 3}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {leftVal}{dualAxis ? '' : unit}
                </text>
                {/* Right Axis Label for Dual Axis */}
                {dualAxis && (
                  <text
                    x={padding.left + chartWidth + 6}
                    y={yPos + 3}
                    textAnchor="start"
                    fill={series[1]?.color || '#38bdf8'}
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {rightVal}
                  </text>
                )}
              </g>
            );
          })}

          {/* Reference Lines (e.g. Scale-Up / Scale-Down Thresholds) */}
          {referenceLines.map((ref, idx) => {
            const refVal = ref.value !== undefined ? ref.value : ref.y;
            if (refVal == null) return null;
            const yPos = getYLeft(refVal);
            if (yPos < padding.top || yPos > padding.top + chartHeight) return null;
            return (
              <g key={`ref-${idx}`}>
                <line
                  x1={padding.left}
                  y1={yPos}
                  x2={padding.left + chartWidth}
                  y2={yPos}
                  stroke={ref.color || '#f59e0b'}
                  strokeWidth="1.5"
                  strokeDasharray="5 3"
                />
                <rect
                  x={padding.left + chartWidth - 110}
                  y={yPos - 9}
                  width={106}
                  height={18}
                  rx={3}
                  fill="#0c1322"
                  stroke={ref.color || '#f59e0b'}
                  strokeWidth="1"
                />
                <text
                  x={padding.left + chartWidth - 57}
                  y={yPos + 3}
                  textAnchor="middle"
                  fill={ref.color || '#f59e0b'}
                  fontSize="10"
                  fontWeight="600"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {ref.label || `${refVal}%`}
                </text>
              </g>
            );
          })}

          {/* Time Axis Labels */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((ratio, i) => {
            const tVal = xMin + ratio * (xMax - xMin);
            const xPos = getX(tVal);
            return (
              <text
                key={i}
                x={xPos}
                y={height - 8}
                textAnchor="middle"
                fill="#64748b"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
              >
                {tVal.toFixed(0)}s
              </text>
            );
          })}

          {/* Series Lines */}
          {paths.map(p => (
            <path
              key={p.key}
              d={p.pathStr}
              fill="none"
              stroke={p.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}

          {/* Interactive Hover Columns */}
          {data.map((d, idx) => {
            const x = getX(d.timestamp || 0);
            return (
              <rect
                key={idx}
                x={x - (chartWidth / Math.max(1, data.length)) / 2}
                y={padding.top}
                width={Math.max(4, chartWidth / Math.max(1, data.length))}
                height={chartHeight}
                fill="transparent"
                style={{ cursor: 'crosshair' }}
                onMouseEnter={() => setHoveredIndex(idx)}
              />
            );
          })}

          {/* Hover Indicator Crosshair */}
          {hoveredIndex !== null && data[hoveredIndex] && (
            <g>
              <line
                x1={getX(data[hoveredIndex].timestamp || 0)}
                y1={padding.top}
                x2={getX(data[hoveredIndex].timestamp || 0)}
                y2={padding.top + chartHeight}
                stroke="#60a5fa"
                strokeWidth="1"
                strokeDasharray="2 2"
              />
              {series.map((s, sIdx) => {
                const val = data[hoveredIndex][s.key] !== undefined ? data[hoveredIndex][s.key] : 0;
                return (
                  <circle
                    key={s.key}
                    cx={getX(data[hoveredIndex].timestamp || 0)}
                    cy={getYForSeries(sIdx, val)}
                    r="4"
                    fill={s.color}
                    stroke="#090d16"
                    strokeWidth="2"
                  />
                );
              })}
            </g>
          )}
        </svg>
      </div>

      {/* Floating Hover Tooltip */}
      {hoveredIndex !== null && data[hoveredIndex] && (
        <div style={{
          position: 'absolute',
          top: '38px',
          right: '24px',
          backgroundColor: '#0a0f1d',
          border: '1px solid #33466d',
          borderRadius: '4px',
          padding: '8px 12px',
          fontSize: '11px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
          zIndex: 10
        }}>
          <div style={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
            T = {(data[hoveredIndex].timestamp || 0).toFixed(1)}s
          </div>
          {series.map((s, sIdx) => (
            <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '14px' }}>
              <span style={{ color: s.color }}>{s.label}:</span>
              <span className="font-mono" style={{ fontWeight: 600, color: '#f8fafc' }}>
                {(data[hoveredIndex][s.key] !== undefined ? Number(data[hoveredIndex][s.key]).toFixed(1) : 0)}
                {dualAxis ? (sIdx === 0 ? ' nodes' : ' req/s') : unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
