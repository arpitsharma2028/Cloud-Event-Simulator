import React, { useState } from 'react';

export default function TelemetryChart({
  data = [],
  title = "Telemetry Timeseries",
  series = [
    { key: 'cpu_util', label: 'CPU Util %', color: '#3b82f6' },
    { key: 'mem_util', label: 'Mem Util %', color: '#10b981' }
  ],
  unit = "%",
  height = 220
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  if (!data || data.length === 0) {
    return (
      <div className="card" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
        No telemetry points recorded yet.
      </div>
    );
  }

  const padding = { top: 20, right: 30, bottom: 30, left: 45 };
  const width = 650;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Determine X range (timestamp)
  const xMin = data[0].timestamp || 0;
  const xMax = Math.max(data[data.length - 1].timestamp || 1, xMin + 0.1);

  // Determine Y range across all series
  let yMin = 0;
  let yMax = 100;
  if (unit !== '%') {
    let maxFound = 0;
    data.forEach(d => {
      series.forEach(s => {
        if (d[s.key] !== undefined && d[s.key] > maxFound) {
          maxFound = d[s.key];
        }
      });
    });
    yMax = Math.max(10, Math.ceil(maxFound * 1.15));
  }

  const getX = (t) => padding.left + ((t - xMin) / (xMax - xMin)) * chartWidth;
  const getY = (val) => padding.top + chartHeight - ((val - yMin) / (yMax - yMin)) * chartHeight;

  // Generate SVG path strings for each series
  const paths = series.map(s => {
    const points = data.map(d => {
      const x = getX(d.timestamp || 0);
      const val = d[s.key] !== undefined ? d[s.key] : 0;
      const y = getY(val);
      return `${x},${y}`;
    });
    return {
      ...s,
      pathStr: points.length > 0 ? `M ${points.join(' L ')}` : ''
    };
  });

  return (
    <div className="card" style={{ padding: '16px', position: 'relative' }}>
      {/* Header & Legend */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          {title}
        </span>
        <div style={{ display: 'flex', gap: '16px', fontSize: '11px' }}>
          {series.map(s => (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: 10, height: 3, backgroundColor: s.color, display: 'inline-block', borderRadius: 1 }}></span>
              <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Responsive SVG Chart */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: 'auto', display: 'block' }}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {/* Horizontal Gridlines */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((ratio, i) => {
            const yVal = yMin + ratio * (yMax - yMin);
            const yPos = getY(yVal);
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
                <text
                  x={padding.left - 6}
                  y={yPos + 3}
                  textAnchor="end"
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {Math.round(yVal)}{unit}
                </text>
              </g>
            );
          })}

          {/* Time Axis Labels */}
          {[0, 0.33, 0.66, 1.0].map((ratio, i) => {
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

          {/* Invisible interactive hover vertical bars */}
          {data.map((d, idx) => {
            const x = getX(d.timestamp || 0);
            return (
              <rect
                key={idx}
                x={x - (chartWidth / data.length) / 2}
                y={padding.top}
                width={Math.max(4, chartWidth / data.length)}
                height={chartHeight}
                fill="transparent"
                style={{ cursor: 'crosshair' }}
                onMouseEnter={() => setHoveredIndex(idx)}
              />
            );
          })}

          {/* Hover Crosshair and Dot Indicator */}
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
              {series.map(s => {
                const val = data[hoveredIndex][s.key] !== undefined ? data[hoveredIndex][s.key] : 0;
                return (
                  <circle
                    key={s.key}
                    cx={getX(data[hoveredIndex].timestamp || 0)}
                    cy={getY(val)}
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
          top: '40px',
          right: '24px',
          backgroundColor: '#0a0f1d',
          border: '1px solid #33466d',
          borderRadius: '4px',
          padding: '8px 12px',
          fontSize: '11px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          pointerEvents: 'none'
        }}>
          <div style={{ color: '#94a3b8', marginBottom: '4px', fontWeight: 600 }}>
            T = {(data[hoveredIndex].timestamp || 0).toFixed(1)}s
          </div>
          {series.map(s => (
            <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ color: s.color }}>{s.label}:</span>
              <span className="font-mono" style={{ fontWeight: 600, color: '#f8fafc' }}>
                {(data[hoveredIndex][s.key] !== undefined ? Number(data[hoveredIndex][s.key]).toFixed(1) : 0)}{unit}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
