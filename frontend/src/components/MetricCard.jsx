import React from 'react';

export default function MetricCard({ title, value, unit, subtitle, icon: Icon, alert = false, color = 'blue' }) {
  const accentColor = color === 'green' ? '#10b981' :
                      color === 'amber' ? '#f59e0b' :
                      color === 'red' ? '#ef4444' : '#3b82f6';

  return (
    <div className="card" style={{ borderColor: alert ? 'rgba(239, 68, 68, 0.4)' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
        {Icon && <Icon size={16} color={accentColor} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{ fontSize: '22px', fontWeight: 700, color: alert ? '#f87171' : 'var(--text-primary)', fontFamily: 'JetBrains Mono, monospace' }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
      {subtitle && (
        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
