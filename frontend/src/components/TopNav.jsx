import React from 'react';
import { Server, Activity, Sliders, BarChart3, GitCompare, Cpu } from 'lucide-react';

export default function TopNav({ activeTab, onSelectTab, activeSimulationCount = 0 }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'studio', label: 'Workload Studio', icon: Sliders },
    { id: 'console', label: 'Simulation Console', icon: Cpu },
    { id: 'results', label: 'Results & Analytics', icon: BarChart3 },
    { id: 'comparison', label: 'Comparison Studio', icon: GitCompare }
  ];

  return (
    <header style={{
      backgroundColor: '#0a0f1d',
      borderBottom: '1px solid var(--border-subtle)',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      <div style={{
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '0 24px',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            backgroundColor: 'rgba(37, 99, 235, 0.15)',
            border: '1px solid rgba(37, 99, 235, 0.4)',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Server size={18} color="#3b82f6" />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, letterSpacing: '0.04em', color: '#f8fafc' }}>
              CLOUD EVENT SIMULATOR
            </div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Cloud Infrastructure & Scheduling Engine
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav style={{ display: 'flex', gap: '4px' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 14px',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#ffffff' : '#94a3b8',
                  backgroundColor: isActive ? '#1e293b' : 'transparent',
                  border: isActive ? '1px solid #334155' : '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={15} color={isActive ? '#3b82f6' : '#64748b'} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* System Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#94a3b8' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
            <span>Engine: C++14 DES</span>
          </div>
          <div style={{
            padding: '3px 8px',
            backgroundColor: '#141e33',
            border: '1px solid #24324f',
            borderRadius: '4px',
            fontSize: '11px',
            fontFamily: 'monospace',
            color: '#60a5fa'
          }}>
            v1.0.0
          </div>
        </div>
      </div>
    </header>
  );
}
