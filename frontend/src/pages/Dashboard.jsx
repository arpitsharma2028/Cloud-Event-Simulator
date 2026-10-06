import React, { useState } from 'react';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';
import { Play, Plus, Server, Activity, Clock, ShieldCheck, DollarSign, ArrowRight, Trash2, Eye, GitCompare } from 'lucide-react';

export default function Dashboard({
  simulations = [],
  presets = [],
  onSelectSimulation,
  onLaunchPreset,
  onNavigate,
  onDeleteSimulation,
  onCompareSimulations
}) {
  const [selectedForCompare, setSelectedForCompare] = useState([]);

  const completedSims = simulations.filter(s => s.status === 'COMPLETED');
  const totalCompletedRequests = completedSims.reduce((sum, s) => sum + (s.summary ? s.summary.total_requests_completed : 0), 0);
  const avgSla = completedSims.length > 0
    ? (completedSims.reduce((sum, s) => sum + (s.summary ? s.summary.sla_compliance_rate_pct : 0), 0) / completedSims.length).toFixed(1)
    : '100.0';

  const toggleCompareSelect = (id) => {
    setSelectedForCompare(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleRunComparison = () => {
    if (selectedForCompare.length >= 2) {
      onCompareSimulations(selectedForCompare);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Banner / Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 24px',
        backgroundColor: '#0c1322',
        border: '1px solid var(--border-subtle)',
        borderRadius: '6px'
      }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
            Cloud Behavior & Infrastructure Simulation Console
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Discrete event simulation platform modeling cloud scheduling algorithms, load balancing, elastic scaling, failures, and cost metrics.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-primary"
            onClick={() => onNavigate('studio')}
          >
            <Plus size={15} />
            Configure New Simulation
          </button>
        </div>
      </div>

      {/* High-Level Cluster Summary Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px'
      }}>
        <MetricCard
          title="Total Simulations Run"
          value={simulations.length}
          subtitle={`${completedSims.length} completed successfully`}
          icon={Activity}
          color="blue"
        />
        <MetricCard
          title="Total Requests Simulated"
          value={totalCompletedRequests.toLocaleString()}
          subtitle="Processed across virtual nodes"
          icon={Server}
          color="green"
        />
        <MetricCard
          title="Average SLA Compliance"
          value={`${avgSla}%`}
          subtitle="Latency under target threshold"
          icon={ShieldCheck}
          color="green"
        />
        <MetricCard
          title="Active Engine Architecture"
          value="C++14 DES"
          subtitle="Deterministic Discrete-Event Core"
          icon={Clock}
          color="blue"
        />
      </div>

      {/* Preset Academic Scenarios Quick Launch */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
              Standard Academic Scenarios & Workload Presets
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Pre-configured scenarios designed for viva evaluation and cloud behavior demonstration.
            </p>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '14px'
        }}>
          {presets.map((p) => (
            <div
              key={p.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.15s ease',
                cursor: 'pointer'
              }}
              onClick={() => onLaunchPreset(p)}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    padding: '2px 6px',
                    borderRadius: '2px',
                    backgroundColor: 'rgba(59, 130, 246, 0.15)',
                    color: '#60a5fa'
                  }}>
                    {p.category}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {p.config.duration}s run
                  </span>
                </div>

                <div style={{ fontWeight: 600, fontSize: '13px', color: '#f8fafc', marginBottom: '6px' }}>
                  {p.name}
                </div>

                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '14px' }}>
                  {p.description}
                </p>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: '10px',
                borderTop: '1px solid rgba(51, 70, 109, 0.4)'
              }}>
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  {p.config.scheduler} / {p.config.initial_nodes} nodes
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#3b82f6', fontWeight: 500 }}>
                  Launch <ArrowRight size={13} />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Simulation Run History */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#f8fafc' }}>
              Simulation Runs History
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Completed simulation experiments available for detailed inspection or side-by-side comparison.
            </p>
          </div>

          {selectedForCompare.length >= 2 && (
            <button
              className="btn btn-primary"
              style={{ fontSize: '12px', padding: '6px 12px' }}
              onClick={handleRunComparison}
            >
              <GitCompare size={14} />
              Compare {selectedForCompare.length} Selected Runs
            </button>
          )}
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {simulations.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No simulations have been run yet. Select an academic preset above or create a new workload in the Workload Studio.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>Select</th>
                    <th>Simulation Name</th>
                    <th>Scheduler</th>
                    <th>Load Balancer</th>
                    <th>Scaling</th>
                    <th>Completed</th>
                    <th>Throughput</th>
                    <th>Avg Latency</th>
                    <th>SLA Compliance</th>
                    <th>Simulated Cost</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {simulations.map((sim) => {
                    const isSelected = selectedForCompare.includes(sim.id);
                    const hasSummary = Boolean(sim.summary);
                    return (
                      <tr key={sim.id} style={{ backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : undefined }}>
                        <td>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleCompareSelect(sim.id)}
                            style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                          />
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>{sim.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                            {new Date(sim.createdAt).toLocaleTimeString()}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: '#141e33', borderRadius: '3px', border: '1px solid #24324f' }}>
                            {sim.scheduler}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                            {sim.loadBalancer}
                          </span>
                        </td>
                        <td>
                          <StatusBadge status={sim.autoScalerEnabled ? 'HEALTHY' : 'IDLE'} />
                        </td>
                        <td className="font-mono">
                          {hasSummary ? `${sim.summary.total_requests_completed} reqs` : '-'}
                        </td>
                        <td className="font-mono" style={{ color: '#60a5fa' }}>
                          {hasSummary ? `${sim.summary.overall_throughput_req_per_sec.toFixed(1)} req/s` : '-'}
                        </td>
                        <td className="font-mono">
                          {hasSummary ? `${sim.summary.avg_latency_ms.toFixed(1)} ms` : '-'}
                        </td>
                        <td>
                          {hasSummary ? (
                            <span style={{
                              fontWeight: 600,
                              color: sim.summary.sla_compliance_rate_pct >= 95 ? '#10b981' : sim.summary.sla_compliance_rate_pct >= 85 ? '#f59e0b' : '#ef4444'
                            }}>
                              {sim.summary.sla_compliance_rate_pct.toFixed(1)}%
                            </span>
                          ) : '-'}
                        </td>
                        <td className="font-mono" style={{ color: '#34d399' }}>
                          {hasSummary ? `$${sim.summary.total_cost_usd.toFixed(4)}` : '-'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px' }}
                              onClick={() => onSelectSimulation(sim.id)}
                              title="Inspect full results"
                            >
                              <Eye size={13} />
                              View
                            </button>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '4px 8px', fontSize: '11px', color: '#f87171' }}
                              onClick={() => onDeleteSimulation(sim.id)}
                              title="Delete run"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
