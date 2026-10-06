import React from 'react';

export default function StatusBadge({ status, size = 'sm' }) {
  if (!status) return null;

  const normalized = String(status).toUpperCase();
  let badgeClass = 'status-badge-idle';

  if (normalized === 'HEALTHY' || normalized === 'COMPLETED' || normalized === 'RUNNING' || normalized === 'SCALE_UP') {
    badgeClass = 'status-badge-healthy';
  } else if (normalized === 'BUSY' || normalized === 'QUEUED' || normalized === 'PENDING' || normalized === 'SCALE_DOWN') {
    badgeClass = 'status-badge-busy';
  } else if (normalized === 'OVERLOADED' || normalized === 'FAILED' || normalized === 'REJECTED' || normalized === 'NODE_FAILURE') {
    badgeClass = 'status-badge-failed';
  } else if (normalized === 'RECOVERING' || normalized === 'NODE_RECOVERY' || normalized === 'METRIC_SAMPLE') {
    badgeClass = 'status-badge-blue';
  }

  const dotColor = badgeClass === 'status-badge-healthy' ? '#10b981' :
                   badgeClass === 'status-badge-busy' ? '#f59e0b' :
                   badgeClass === 'status-badge-failed' ? '#ef4444' :
                   badgeClass === 'status-badge-blue' ? '#3b82f6' : '#94a3b8';

  return (
    <span className={`status-badge ${badgeClass}`}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: dotColor, display: 'inline-block' }}></span>
      {normalized}
    </span>
  );
}
