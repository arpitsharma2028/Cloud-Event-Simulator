import React, { useState } from 'react';
import { Server, Activity, Sliders, BarChart3, GitCompare, Cpu, BookOpen } from 'lucide-react';
import ModelReferenceModal from './ModelReferenceModal';

export default function TopNav({ activeTab, onSelectTab, activeSimulationCount = 0 }) {
  const [showReferenceModal, setShowReferenceModal] = useState(false);
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Activity },
    { id: 'studio', label: 'Workload Studio', icon: Sliders },
    { id: 'console', label: 'Simulation Console', icon: Cpu },
    { id: 'results', label: 'Results & Analytics', icon: BarChart3 },
    { id: 'comparison', label: 'Comparison Studio', icon: GitCompare }
  ];

  return (
    <>
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
                Discrete-Event Cloud Architecture Platform
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

          {/* System Status & Model Reference Modal Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button
              onClick={() => setShowReferenceModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 10px',
                backgroundColor: '#141e33',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#93c5fd',
                cursor: 'pointer'
              }}
              title="View mathematical formulas and simulation assumptions"
            >
              <BookOpen size={13} color="#60a5fa" />
              <span>Assumptions & Metrics</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#94a3b8' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
              <span>C++14 Engine</span>
            </div>
          </div>
        </div>
      </header>

      {/* Model Reference & Assumptions Modal */}
      <ModelReferenceModal
        isOpen={showReferenceModal}
        onClose={() => setShowReferenceModal(false)}
      />
    </>
  );
}
