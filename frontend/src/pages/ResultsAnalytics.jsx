import React from 'react';
import MetricCard from '../components/MetricCard';
import TelemetryChart from '../components/TelemetryChart';
import EventTable from '../components/EventTable';
import DecisionLog from '../components/DecisionLog';
import StatusBadge from '../components/StatusBadge';
import {
  Download, ArrowLeft, CheckCircle, AlertOctagon,
  Clock, DollarSign, Activity, Server, ShieldCheck, Zap, Layers
} from 'lucide-react';

export default function ResultsAnalytics({
  simulation,
  onBackToConsole
}) {
  if (!simulation || !simulation.result || !simulation.result.summary) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
        No completed simulation results to display. Please run a simulation first.
      </div>
    );
  }

  const { result, config } = simulation;
  const s = result.summary;

  const download = (content, type, filename) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = filename;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const handleExportJson = () => {
    download(JSON.stringify(result, null, 2), 'application/json', `cloud_sim_${simulation.id}.json`);
  };

  const handleExportCsv = () => {
    const headers = ["Timestamp_sec", "CPU_Util_Pct", "RAM_Util_Pct", "Composite_Util_Pct", "Active_Nodes", "Healthy_Nodes", "Active_Tasks", "Queued_Tasks", "Throughput_Req_Sec", "Avg_Latency_Ms", "Cost_Rate_USD_Hr"];
    const rows = (result.snapshots || []).map(snap => [
      snap.timestamp,
      snap.cpu_util,
      snap.mem_util,
      snap.composite_util,
      snap.active_nodes,
      snap.healthy_nodes,
      snap.active_tasks,
      snap.queued_tasks,
      snap.throughput,
      snap.avg_latency_ms,
      snap.cost_rate
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    download(csvContent, 'text/csv;charset=utf-8', `cloud_sim_telemetry_${simulation.id}.csv`);
  };

  // Explicit Traffic Horizon Accounting
  const totalCompleted = s.total_requests_completed || 0;
  const totalFailed = s.total_requests_failed || 0;
  const totalRejected = s.total_requests_rejected || 0;
  const totalDroppedOrFailed = totalFailed + totalRejected;
  const inFlightAtHorizon = s.total_requests_unfinished ?? Math.max(0, (s.total_requests_submitted || 0) - totalCompleted - totalDroppedOrFailed);

  const evaluatedCompleted = totalCompleted + totalDroppedOrFailed;
  const executionSuccessRatePct = evaluatedCompleted > 0
    ? (totalCompleted / evaluatedCompleted) * 100.0
    : 100.0;

  // SLA Compliance with 3-tier color escalation
  const slaCompliancePct = s.sla_compliance_rate_pct != null ? s.sla_compliance_rate_pct : 100.0;
  const isSlaBreached = slaCompliancePct < 80.0;
  const isSlaAtRisk = slaCompliancePct >= 80.0 && slaCompliancePct < 95.0;
  const slaColor = slaCompliancePct >= 95.0 ? 'green' : (slaCompliancePct >= 80.0 ? 'amber' : 'red');

  const slaTargetMs = s.sla_target_latency_ms || config.sla_target_ms || 250;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* Header Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        backgroundColor: '#0c1322',
        border: '1px solid var(--border-subtle)',
        borderRadius: '6px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button
            className="btn btn-secondary"
            onClick={onBackToConsole}
            style={{ padding: '6px 12px' }}
          >
            <ArrowLeft size={14} /> Back to Console
          </button>
          <div>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
              Results & Analytics: {simulation.name || config.name}
            </h1>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Completed in {simulation.executionTimeMs || '1.2'}ms via C++ discrete-event engine | Seed: {config.seed}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            onClick={handleExportCsv}
            title="Download CSV for Excel or plotting"
          >
            <Download size={14} />
            Export CSV
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExportJson}
            title="Download full JSON dataset"
          >
            <Download size={14} />
            Export Results JSON
          </button>
        </div>
      </div>

      {/* Traffic Horizon Accounting Card: Completed vs In-Flight vs Failed */}
      <div className="card" style={{ padding: '16px 20px', backgroundColor: '#0d1527' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px' }}>
          Workload Lifecycle & Horizon Accounting (T = {s.total_simulation_time.toFixed(1)}s Cutoff)
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px'
        }}>
          {/* Completed */}
          <div style={{ padding: '12px 14px', backgroundColor: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
              <CheckCircle size={14} /> COMPLETED TRAFFIC
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', fontFamily: 'JetBrains Mono, monospace' }}>
              {totalCompleted} <span style={{ fontSize: '12px', fontWeight: 400, color: '#94a3b8' }}>/ {s.total_requests_submitted} reqs</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Fully serviced and delivered
            </div>
          </div>

          {/* In-Flight at Horizon */}
          <div style={{ padding: '12px 14px', backgroundColor: 'rgba(56, 189, 248, 0.08)', border: '1px solid rgba(56, 189, 248, 0.3)', borderRadius: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
              <Clock size={14} /> IN-FLIGHT AT HORIZON
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: '#f8fafc', fontFamily: 'JetBrains Mono, monospace' }}>
              {inFlightAtHorizon} <span style={{ fontSize: '12px', fontWeight: 400, color: '#94a3b8' }}>reqs</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Active/queued at cutoff (not counted as failures)
            </div>
          </div>

          {/* Failed / Dropped */}
          <div style={{
            padding: '12px 14px',
            backgroundColor: totalDroppedOrFailed > 0 ? 'rgba(239, 68, 68, 0.08)' : 'rgba(100, 116, 139, 0.08)',
            border: totalDroppedOrFailed > 0 ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(100, 116, 139, 0.25)',
            borderRadius: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: totalDroppedOrFailed > 0 ? '#f87171' : '#94a3b8', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>
              <AlertOctagon size={14} /> FAILED & REJECTED
            </div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: totalDroppedOrFailed > 0 ? '#f87171' : '#f8fafc', fontFamily: 'JetBrains Mono, monospace' }}>
              {totalDroppedOrFailed} <span style={{ fontSize: '12px', fontWeight: 400, color: '#94a3b8' }}>reqs</span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {totalFailed} outage evictions, {totalRejected} queue overflow drops
            </div>
          </div>
        </div>
      </div>

      {/* Primary KPI Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px'
      }}>
        <MetricCard
          title="Execution Success Rate"
          value={evaluatedCompleted > 0 ? `${executionSuccessRatePct.toFixed(1)}%` : 'N/A'}
          subtitle={`${totalCompleted} completed | ${totalDroppedOrFailed} failed/dropped`}
          icon={CheckCircle}
          color={executionSuccessRatePct >= 95 ? 'green' : executionSuccessRatePct >= 80 ? 'amber' : 'red'}
          alert={executionSuccessRatePct < 80}
        />
        <MetricCard
          title="Average Latency"
          value={`${s.avg_latency_ms.toFixed(1)}`}
          unit="ms"
          subtitle={`P95: ${s.p95_latency_ms.toFixed(1)}ms | P99: ${s.p99_latency_ms.toFixed(1)}ms`}
          icon={Clock}
          color="blue"
        />
        <MetricCard
          title="Mean Throughput"
          value={`${s.overall_throughput_req_per_sec.toFixed(2)}`}
          unit="req/s"
          subtitle={`Over ${s.total_simulation_time.toFixed(1)}s sim time`}
          icon={Activity}
          color="green"
        />
        <MetricCard
          title="SLA Compliance"
          value={s.total_requests_completed ? `${slaCompliancePct.toFixed(1)}%` : 'N/A'}
          subtitle={s.total_requests_completed ? `${s.sla_violation_count || 0} violations (≤ ${slaTargetMs}ms target)` : 'No completed requests to evaluate'}
          icon={ShieldCheck}
          alert={isSlaBreached}
          color={slaColor}
        />
        <MetricCard
          title="Total Simulated Cost"
          value={`$${s.total_cost_usd.toFixed(4)}`}
          unit="USD"
          subtitle={`$${s.cost_per_1000_requests_usd.toFixed(4)} / 1k completed reqs`}
          icon={DollarSign}
          color="green"
        />
        <MetricCard
          title="Cluster Availability"
          value={`${s.cluster_availability_pct.toFixed(2)}%`}
          subtitle={`${s.total_node_failures} outages | ${s.total_node_recoveries} recoveries`}
          icon={Server}
          color={s.cluster_availability_pct >= 99 ? 'green' : 'amber'}
        />
      </div>

      {/* Detailed Analysis Breakdown Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        
        {/* Card 1: Latency Distribution & Queue Decomposition */}
        <div className="card">
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            Latency Distribution & Queue Decomposition
          </div>
          <table className="data-table" style={{ margin: 0 }}>
            <tbody>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Avg Queue Wait Time</td>
                <td className="font-mono" style={{ textAlign: 'right', color: '#60a5fa' }}>{(s.avg_queue_wait_ms ?? 0).toFixed(1)} ms</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Avg Task Execution Duration</td>
                <td className="font-mono" style={{ textAlign: 'right' }}>{Math.max(0, s.avg_latency_ms - (s.avg_queue_wait_ms ?? 0)).toFixed(1)} ms</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Total Average Latency</td>
                <td className="font-mono" style={{ textAlign: 'right', fontWeight: 700, color: '#f8fafc' }}>{s.avg_latency_ms.toFixed(1)} ms</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Median (P50) Latency</td>
                <td className="font-mono" style={{ textAlign: 'right' }}>{s.p50_latency_ms.toFixed(1)} ms</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>P95 Tail Latency</td>
                <td className="font-mono" style={{ textAlign: 'right', color: s.p95_latency_ms > slaTargetMs ? '#f87171' : '#60a5fa' }}>
                  {s.p95_latency_ms.toFixed(1)} ms
                </td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Maximum Latency Observed</td>
                <td className="font-mono" style={{ textAlign: 'right' }}>{s.max_latency_ms.toFixed(1)} ms</td>
              </tr>
            </tbody>
          </table>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
            Mathematical Identity: Response Time = Queue Wait Time + Execution Duration
          </div>
        </div>

        {/* Card 2: Cluster Utilization & Elasticity */}
        <div className="card">
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            Cluster Utilization & Elasticity
          </div>
          <table className="data-table" style={{ margin: 0 }}>
            <tbody>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Average CPU Utilization</td>
                <td className="font-mono" style={{ textAlign: 'right' }}>{s.avg_cpu_utilization.toFixed(1)}%</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Peak CPU Utilization</td>
                <td className="font-mono" style={{ textAlign: 'right' }}>{s.peak_cpu_utilization.toFixed(1)}%</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Average Memory Utilization</td>
                <td className="font-mono" style={{ textAlign: 'right' }}>{(s.avg_mem_utilization ?? 0).toFixed(1)}%</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Peak Queue Length</td>
                <td className="font-mono" style={{ textAlign: 'right' }}>{s.peak_queue_length ?? 0} tasks</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Scale-Up / Scale-Down Events</td>
                <td className="font-mono" style={{ textAlign: 'right', color: '#a78bfa' }}>+{s.scale_up_events} / -{s.scale_down_events}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Cluster Scale Range</td>
                <td className="font-mono" style={{ textAlign: 'right' }}>{s.min_nodes_observed} to {s.max_nodes_observed} nodes</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Card 3: Financial & Metering Breakdown */}
        <div className="card">
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            Simulated Cost & Metering
          </div>
          <table className="data-table" style={{ margin: 0 }}>
            <tbody>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>vCPU Compute Charges</td>
                <td className="font-mono" style={{ textAlign: 'right' }}>${s.compute_cost_usd.toFixed(5)}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Memory Allocation Charges</td>
                <td className="font-mono" style={{ textAlign: 'right' }}>${s.memory_cost_usd.toFixed(5)}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Idle Capacity Overhead</td>
                <td className="font-mono" style={{ textAlign: 'right', color: '#f59e0b' }}>${s.idle_waste_cost_usd.toFixed(5)}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Total Infrastructure Bill</td>
                <td className="font-mono" style={{ textAlign: 'right', fontWeight: 700, color: '#34d399' }}>${s.total_cost_usd.toFixed(5)}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Unit Cost per 1k Requests</td>
                <td className="font-mono" style={{ textAlign: 'right' }}>${s.cost_per_1000_requests_usd.toFixed(4)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Telemetry Charts: Dual Y-Axis for Throughput & Latency */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
        <TelemetryChart
          title="Cluster Utilization Profile (%)"
          data={result.snapshots || []}
          series={[
            { key: 'cpu_util', label: 'CPU Utilization %', color: '#3b82f6' },
            { key: 'mem_util', label: 'Memory Utilization %', color: '#10b981' }
          ]}
          unit="%"
          totalDuration={config.duration}
        />
        <TelemetryChart
          title="Throughput & Average Latency"
          data={result.snapshots || []}
          series={[
            { key: 'throughput', label: 'Throughput (req/s)', color: '#38bdf8' },
            { key: 'avg_latency_ms', label: 'Latency (ms)', color: '#fbbf24' }
          ]}
          unit=""
          dualAxis={true}
          totalDuration={config.duration}
        />
      </div>

      {/* Traceability & Events */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <DecisionLog traces={result.decision_trace || []} />
        <EventTable events={result.event_log || []} />
      </div>
    </div>
  );
}
