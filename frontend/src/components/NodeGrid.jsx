import React from 'react';
import StatusBadge from './StatusBadge';
import { HardDrive, Server, Layers, Sparkles } from 'lucide-react';

export default function NodeGrid({ nodes = [], selectedNodeId = null, highlightedNodeIds = new Set() }) {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
        No virtual nodes initialized yet. Start a simulation to inspect cluster state.
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
      gap: '14px'
    }}>
      {nodes.map((node) => {
        const cpuPct = node.cpu_util !== undefined ? node.cpu_util : (node.cpu_capacity ? (node.cpu_used / node.cpu_capacity) * 100 : 0);
        const memPct = node.mem_util !== undefined ? node.mem_util : (node.mem_capacity ? (node.mem_used / node.mem_capacity) * 100 : 0);

        const cpuColor = cpuPct > 90 ? '#ef4444' : cpuPct > 65 ? '#f59e0b' : '#3b82f6';
        const memColor = memPct > 90 ? '#ef4444' : memPct > 65 ? '#f59e0b' : '#10b981';

        const isFailed = node.status === 'FAILED';
        const isOverloaded = node.status === 'OVERLOADED' || cpuPct > 90 || memPct > 90;
        const isRecovering = node.status === 'RECOVERING';
        const isSelected = node.id === selectedNodeId;
        const isHighlighted = highlightedNodeIds && (highlightedNodeIds.has(node.id) || isRecovering);

        let borderStyle = undefined;
        let shadowStyle = undefined;
        let bgStyle = undefined;

        if (isFailed) {
          borderStyle = 'rgba(239, 68, 68, 0.55)';
          bgStyle = 'rgba(239, 68, 68, 0.05)';
        } else if (isOverloaded) {
          borderStyle = 'rgba(239, 68, 68, 0.45)';
          bgStyle = 'rgba(239, 68, 68, 0.04)';
        } else if (isHighlighted) {
          borderStyle = 'rgba(52, 211, 153, 0.7)';
          bgStyle = 'rgba(16, 185, 129, 0.06)';
          shadowStyle = '0 0 14px rgba(16, 185, 129, 0.22), inset 0 0 8px rgba(16, 185, 129, 0.08)';
        }

        return (
          <div
            key={node.id}
            className="card"
            style={{
              backgroundColor: bgStyle,
              borderColor: borderStyle,
              boxShadow: shadowStyle,
              transition: 'border-color 0.25s ease, box-shadow 0.25s ease, background-color 0.25s ease',
              padding: '14px'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={15} color={isFailed || isOverloaded ? '#ef4444' : isHighlighted ? '#34d399' : '#3b82f6'} />
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#f8fafc' }}>
                  {node.name || `Node-${node.id}`}
                </span>
                {isHighlighted && !isFailed && (
                  <span style={{ fontSize: '9px', color: '#34d399', fontWeight: 700, backgroundColor: 'rgba(16, 185, 129, 0.2)', padding: '1px 5px', borderRadius: '3px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                    <Sparkles size={9} /> {isRecovering ? 'RECOVERED' : 'SCALED UP'}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {isSelected && (
                  <span style={{
                    fontSize: '9px',
                    color: '#60a5fa',
                    fontWeight: 700,
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.45)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    letterSpacing: '0.04em'
                  }}>
                    SELECTED
                  </span>
                )}
                <StatusBadge status={node.status} />
              </div>
            </div>

            {/* CPU Utilization Bar */}
            <div style={{ marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px', color: 'var(--text-secondary)' }}>
                <span>CPU in use</span>
                <span className="font-mono">
                  {cpuPct.toFixed(0)}% used
                </span>
              </div>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.min(100, Math.max(0, cpuPct))}%`, backgroundColor: cpuColor }}
                />
              </div>
            </div>

            {/* Memory Utilization Bar */}
            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px', color: 'var(--text-secondary)' }}>
                <span>Memory in use</span>
                <span className="font-mono">
                  {memPct.toFixed(0)}% used
                </span>
              </div>
              <div className="progress-bar-container">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.min(100, Math.max(0, memPct))}%`, backgroundColor: memColor }}
                />
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '6px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(51, 70, 109, 0.4)',
              fontSize: '11px'
            }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Handling: </span>
                <span className="font-mono" style={{ fontWeight: 600, color: '#f8fafc' }}>
                  {node.active_tasks || 0}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Waiting: </span>
                <span className="font-mono" style={{ fontWeight: 600, color: node.queued_tasks > 0 ? '#f59e0b' : '#94a3b8' }}>
                  {node.queued_tasks || 0}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Finished: </span>
                <span className="font-mono" style={{ color: '#10b981' }}>
                  {node.total_processed || 0}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Dropped: </span>
                <span className="font-mono" style={{ color: (node.total_failed || node.total_rejected) ? '#ef4444' : '#64748b' }}>
                  {(node.total_failed || 0) + (node.total_rejected || 0)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

