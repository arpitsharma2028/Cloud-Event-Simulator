import React from 'react';
import StatusBadge from './StatusBadge';
import { HardDrive, Server, Layers } from 'lucide-react';

export default function NodeGrid({ nodes = [] }) {
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
      gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
      gap: '16px'
    }}>
      {nodes.map((node) => {
        const cpuPct = node.cpu_util !== undefined ? node.cpu_util : (node.cpu_capacity ? (node.cpu_used / node.cpu_capacity) * 100 : 0);
        const memPct = node.mem_util !== undefined ? node.mem_util : (node.mem_capacity ? (node.mem_used / node.mem_capacity) * 100 : 0);

        const cpuColor = cpuPct > 90 ? '#ef4444' : cpuPct > 65 ? '#f59e0b' : '#3b82f6';
        const memColor = memPct > 90 ? '#ef4444' : memPct > 65 ? '#f59e0b' : '#10b981';

        const isFailed = node.status === 'FAILED';

        return (
          <div
            key={node.id}
            className="card"
            style={{
              backgroundColor: isFailed ? 'rgba(239, 68, 68, 0.05)' : undefined,
              borderColor: isFailed ? 'rgba(239, 68, 68, 0.4)' : undefined,
              transition: 'border-color 0.2s ease'
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Server size={16} color={isFailed ? '#ef4444' : '#3b82f6'} />
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#f8fafc' }}>
                  {node.name || `Node-${node.id}`}
                </span>
              </div>
              <StatusBadge status={node.status} />
            </div>

            {/* CPU Utilization Bar */}
            <div style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                <span>vCPU Allocation</span>
                <span className="font-mono">
                  {(node.cpu_used || 0).toFixed(1)} / {node.cpu_capacity} Cores ({cpuPct.toFixed(1)}%)
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
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px', color: 'var(--text-secondary)' }}>
                <span>RAM Allocation</span>
                <span className="font-mono">
                  {(node.mem_used || 0).toFixed(1)} / {node.mem_capacity} GB ({memPct.toFixed(1)}%)
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
              gap: '8px',
              paddingTop: '8px',
              borderTop: '1px solid rgba(51, 70, 109, 0.4)',
              fontSize: '11px'
            }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Active Tasks: </span>
                <span className="font-mono" style={{ fontWeight: 600, color: '#f8fafc' }}>
                  {node.active_tasks || 0}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Queue Depth: </span>
                <span className="font-mono" style={{ fontWeight: 600, color: node.queued_tasks > 0 ? '#f59e0b' : '#94a3b8' }}>
                  {node.queued_tasks || 0}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Processed: </span>
                <span className="font-mono" style={{ color: '#10b981' }}>
                  {node.total_processed || 0}
                </span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Failed/Dropped: </span>
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
