import React, { useState } from 'react';
import MetricCard from '../components/MetricCard';
import StatusBadge from '../components/StatusBadge';
import {
  GitCompare, Award, CheckCircle, AlertTriangle,
  ArrowRight, Activity, DollarSign, Clock, HelpCircle
} from 'lucide-react';

export default function ComparisonStudio({
  comparisonData,
  simulations = [],
  onCompareSimulations
}) {
  const [selectedSimIds, setSelectedSimIds] = useState(
    comparisonData ? comparisonData.matrix.map(m => m.id) : []
  );

  const toggleSelect = (id) => {
    setSelectedSimIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleTriggerCompare = () => {
    if (selectedSimIds.length >= 2) {
      onCompareSimulations(selectedSimIds);
    }
  };

  if (!comparisonData || !comparisonData.matrix || comparisonData.matrix.length < 2) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{
          padding: '16px 20px',
          backgroundColor: '#0c1322',
          border: '1px solid var(--border-subtle)',
          borderRadius: '6px'
        }}>
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
            Algorithm & Policy Comparison Studio
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Select 2 or more simulations with identical or contrasting policies to compare performance, latency, SLA compliance, and cost side-by-side.
          </p>
        </div>

        <div className="card">
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '12px' }}>
            Select Simulations to Compare ({selectedSimIds.length} selected)
          </div>

          {simulations.length < 2 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              You need at least 2 simulation runs to perform a comparison. Run another simulation from the Workload Studio or launch one of the presets.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {simulations.map(s => (
                <label
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '4px',
                    backgroundColor: selectedSimIds.includes(s.id) ? 'rgba(37, 99, 235, 0.1)' : '#0c1322',
                    border: selectedSimIds.includes(s.id) ? '1px solid #3b82f6' : '1px solid var(--border-subtle)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="checkbox"
                      checked={selectedSimIds.includes(s.id)}
                      onChange={() => toggleSelect(s.id)}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '13px' }}>{s.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Policy: {s.scheduler} | LB: {s.loadBalancer} | Scale: {s.autoScalerEnabled ? 'On' : 'Off'}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono" style={{ fontSize: '12px', color: '#60a5fa' }}>
                    {s.summary ? `${s.summary.overall_throughput_req_per_sec.toFixed(1)} req/s` : 'In progress'}
                  </span>
                </label>
              ))}

              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary"
                  disabled={selectedSimIds.length < 2}
                  onClick={handleTriggerCompare}
                >
                  <GitCompare size={15} /> Compare Selected Simulations
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const { matrix, insights } = comparisonData;

  // Determine top performers for highlights
  const highestThroughput = Math.max(...matrix.map(m => m.throughputReqSec));
  const lowestLatency = Math.min(...matrix.map(m => m.avgLatencyMs));
  const highestSla = Math.max(...matrix.map(m => m.slaCompliancePct));
  const lowestCost = Math.min(...matrix.map(m => m.totalCostUsd));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        backgroundColor: '#0c1322',
        border: '1px solid var(--border-subtle)',
        borderRadius: '6px'
      }}>
        <div>
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
            Algorithm & Policy Comparison Studio ({matrix.length} Runs Analyzed)
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Comparative evaluation of scheduling algorithms, load balancing distribution, elasticity, and cost trade-offs.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => setSelectedSimIds([])}
          style={{ fontSize: '12px' }}
        >
          Change Selected Runs
        </button>
      </div>

      {/* Academic Viva Insights Cards */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Award size={16} color="#3b82f6" />
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Academic Insights & Viva Defense Analysis
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '14px'
        }}>
          {insights.map((item, idx) => (
            <div key={idx} className="card" style={{ borderColor: 'rgba(59, 130, 246, 0.3)' }}>
              <div style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#60a5fa',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '4px'
              }}>
                {item.category}
              </div>
              <div style={{ fontWeight: 600, fontSize: '13px', color: '#f8fafc', marginBottom: '8px' }}>
                {item.title}
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {item.explanation}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Comparative Matrix Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#0c1322',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: '12px',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.04em'
        }}>
          Side-by-Side Performance & Economics Matrix
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ minWidth: '180px' }}>Simulation Run</th>
                <th>Scheduler</th>
                <th>Load Balancer</th>
                <th>Scaling</th>
                <th>Throughput</th>
                <th>Avg Latency</th>
                <th>P95 Latency</th>
                <th>SLA Compliance</th>
                <th>Avg CPU Util</th>
                <th>Scale Events</th>
                <th>Total Cost</th>
                <th>Cost / 1k Reqs</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row) => {
                const isBestThroughput = row.throughputReqSec === highestThroughput;
                const isBestLatency = row.avgLatencyMs === lowestLatency;
                const isBestSla = row.slaCompliancePct === highestSla;
                const isBestCost = row.totalCostUsd === lowestCost;

                return (
                  <tr key={row.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{row.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {row.initialNodes} initial nodes
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '11px', padding: '2px 6px', backgroundColor: '#141e33', borderRadius: '3px', border: '1px solid #24324f' }}>
                        {row.scheduler}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        {row.loadBalancer}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={row.autoScalerEnabled ? 'HEALTHY' : 'IDLE'} />
                    </td>
                    <td className="font-mono" style={{ color: isBestThroughput ? '#10b981' : '#f8fafc', fontWeight: isBestThroughput ? 700 : 400 }}>
                      {row.throughputReqSec.toFixed(2)} req/s
                      {isBestThroughput && <span style={{ fontSize: '10px', color: '#10b981', marginLeft: '4px' }}>★</span>}
                    </td>
                    <td className="font-mono" style={{ color: isBestLatency ? '#10b981' : '#f8fafc', fontWeight: isBestLatency ? 700 : 400 }}>
                      {row.avgLatencyMs.toFixed(1)} ms
                      {isBestLatency && <span style={{ fontSize: '10px', color: '#10b981', marginLeft: '4px' }}>★</span>}
                    </td>
                    <td className="font-mono">
                      {row.p95LatencyMs.toFixed(1)} ms
                    </td>
                    <td className="font-mono" style={{ color: isBestSla ? '#10b981' : row.slaCompliancePct >= 90 ? '#f8fafc' : '#f87171', fontWeight: isBestSla ? 700 : 400 }}>
                      {row.slaCompliancePct.toFixed(1)}%
                      {isBestSla && <span style={{ fontSize: '10px', color: '#10b981', marginLeft: '4px' }}>★</span>}
                    </td>
                    <td className="font-mono">
                      {row.avgCpuUtil.toFixed(1)}%
                    </td>
                    <td className="font-mono">
                      +{row.scaleUpEvents} / -{row.scaleDownEvents}
                    </td>
                    <td className="font-mono" style={{ color: isBestCost ? '#10b981' : '#f8fafc', fontWeight: isBestCost ? 700 : 400 }}>
                      ${row.totalCostUsd.toFixed(4)}
                      {isBestCost && <span style={{ fontSize: '10px', color: '#10b981', marginLeft: '4px' }}>★</span>}
                    </td>
                    <td className="font-mono" style={{ color: '#34d399' }}>
                      ${row.costPer1000ReqUsd.toFixed(4)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
