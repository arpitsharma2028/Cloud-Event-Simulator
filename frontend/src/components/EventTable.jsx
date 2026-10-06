import React, { useState } from 'react';
import StatusBadge from './StatusBadge';
import { Filter, Search } from 'lucide-react';

export default function EventTable({ events = [] }) {
  const [filterType, setFilterType] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 15;

  const filteredEvents = events.filter(e => {
    if (filterType !== 'ALL' && e.type !== filterType) return false;
    if (filterStatus !== 'ALL' && e.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = String(e.id).includes(q) || String(e.task_id).includes(q);
      const matchLog = (e.log || '').toLowerCase().includes(q);
      const matchType = (e.type || '').toLowerCase().includes(q);
      if (!matchId && !matchLog && !matchType) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filteredEvents.length / pageSize);
  const pagedEvents = filteredEvents.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
      {/* Controls Bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        backgroundColor: '#0c1322',
        borderBottom: '1px solid var(--border-subtle)',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Event Log ({filteredEvents.length} events)
          </span>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '180px' }}>
            <input
              type="text"
              placeholder="Search ID, trace..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
              style={{ paddingLeft: '28px', height: '30px', fontSize: '12px' }}
            />
            <Search size={14} color="#64748b" style={{ position: 'absolute', left: '8px', top: '8px' }} />
          </div>

          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(0); }}
            style={{ width: '140px', height: '30px', fontSize: '12px', padding: '4px 8px' }}
          >
            <option value="ALL">All Event Types</option>
            <option value="REQUEST_ARRIVAL">Request Arrival</option>
            <option value="TASK_COMPLETE">Task Complete</option>
            <option value="NODE_FAILURE">Node Failure</option>
            <option value="NODE_RECOVERY">Node Recovery</option>
            <option value="WORKLOAD_SPIKE">Workload Spike</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(0); }}
            style={{ width: '130px', height: '30px', fontSize: '12px', padding: '4px 8px' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="COMPLETED">Completed</option>
            <option value="RUNNING">Running</option>
            <option value="QUEUED">Queued</option>
            <option value="REJECTED">Rejected</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '70px' }}>Time</th>
              <th style={{ width: '70px' }}>Evt ID</th>
              <th style={{ width: '120px' }}>Type</th>
              <th style={{ width: '60px' }}>Prio</th>
              <th style={{ width: '80px' }}>Node</th>
              <th style={{ width: '75px' }}>Task ID</th>
              <th style={{ width: '90px' }}>vCPU / RAM</th>
              <th style={{ width: '95px' }}>Status</th>
              <th>Decision & Allocation Trace</th>
            </tr>
          </thead>
          <tbody>
            {pagedEvents.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  No matching events found.
                </td>
              </tr>
            ) : (
              pagedEvents.map((ev) => (
                <tr key={`${ev.id}-${ev.timestamp}-${ev.type}`}>
                  <td className="font-mono" style={{ color: '#60a5fa' }}>
                    {Number(ev.timestamp).toFixed(2)}s
                  </td>
                  <td className="font-mono" style={{ color: 'var(--text-muted)' }}>
                    #{ev.id}
                  </td>
                  <td style={{ fontWeight: 500 }}>
                    {ev.type}
                  </td>
                  <td>
                    <span style={{
                      padding: '1px 5px',
                      borderRadius: '2px',
                      fontSize: '10px',
                      fontWeight: 700,
                      backgroundColor: ev.priority === 1 ? 'rgba(239, 68, 68, 0.2)' : ev.priority === 2 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(100, 116, 139, 0.2)',
                      color: ev.priority === 1 ? '#f87171' : ev.priority === 2 ? '#60a5fa' : '#94a3b8'
                    }}>
                      P{ev.priority || 2}
                    </span>
                  </td>
                  <td className="font-mono">
                    {ev.node_id && ev.node_id !== -1 ? `Node-${ev.node_id}` : '-'}
                  </td>
                  <td className="font-mono" style={{ color: 'var(--text-muted)' }}>
                    {ev.task_id ? `#${ev.task_id}` : '-'}
                  </td>
                  <td className="font-mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {ev.cpu ? `${ev.cpu}c / ${ev.mem}GB` : '-'}
                  </td>
                  <td>
                    <StatusBadge status={ev.status} />
                  </td>
                  <td style={{ fontSize: '11px', color: 'var(--text-secondary)', maxWidth: '350px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={ev.log}>
                    {ev.log || '-'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          backgroundColor: '#0c1322',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: '12px'
        }}>
          <span style={{ color: 'var(--text-muted)' }}>
            Page {page + 1} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '11px' }}
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 10px', fontSize: '11px' }}
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
