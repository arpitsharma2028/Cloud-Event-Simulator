import React, { useState } from 'react';
import { Terminal, Copy, Check } from 'lucide-react';

export default function DecisionLog({ traces = [] }) {
  const [filter, setFilter] = useState('');
  const [copied, setCopied] = useState(false);

  const filteredTraces = traces.filter(t => {
    if (!filter) return true;
    return t.toLowerCase().includes(filter.toLowerCase());
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(traces.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
      {/* Trace Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        backgroundColor: '#0c1322',
        borderBottom: '1px solid var(--border-subtle)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={15} color="#3b82f6" />
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Decision Trace & Traceability ({traces.length} entries)
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="text"
            placeholder="Filter trace (e.g. ALLOC, SCALE, DROP)..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ width: '220px', height: '28px', fontSize: '11px', padding: '4px 8px' }}
          />
          <button
            className="btn btn-secondary"
            onClick={handleCopy}
            style={{ padding: '4px 10px', fontSize: '11px' }}
            title="Copy trace log to clipboard"
          >
            {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>

      {/* Terminal View */}
      <div style={{
        backgroundColor: '#070b14',
        padding: '14px 16px',
        maxHeight: '360px',
        overflowY: 'auto',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '11px',
        lineHeight: 1.6
      }}>
        {filteredTraces.length === 0 ? (
          <div style={{ color: '#64748b', fontStyle: 'italic' }}>
            No trace entries matching filter.
          </div>
        ) : (
          filteredTraces.map((line, idx) => {
            let lineStyle = { color: '#cbd5e1' };

            if (line.includes('ALLOC:')) {
              lineStyle = { color: '#60a5fa' };
            } else if (line.includes('COMPLETE:')) {
              lineStyle = { color: '#34d399' };
            } else if (line.includes('SCALE_UP:') || line.includes('AUTOSCALE_UP')) {
              lineStyle = { color: '#a78bfa' };
            } else if (line.includes('SCALE_DOWN:') || line.includes('AUTOSCALE_DOWN')) {
              lineStyle = { color: '#fbbf24' };
            } else if (line.includes('NODE_FAILURE') || line.includes('DROP:') || line.includes('REJECT:')) {
              lineStyle = { color: '#f87171' };
            } else if (line.includes('NODE_RECOVERY')) {
              lineStyle = { color: '#38bdf8' };
            } else if (line.includes('QUEUED:')) {
              lineStyle = { color: '#fb923c' };
            }

            return (
              <div key={idx} style={{ marginBottom: '3px', wordBreak: 'break-word', ...lineStyle }}>
                {line}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
