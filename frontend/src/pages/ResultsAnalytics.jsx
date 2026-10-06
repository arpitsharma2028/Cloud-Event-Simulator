import React from 'react';
import MetricCard from '../components/MetricCard';
import TelemetryChart from '../components/TelemetryChart';
import EventTable from '../components/EventTable';
import DecisionLog from '../components/DecisionLog';
import StatusBadge from '../components/StatusBadge';
import {
  Download, ArrowLeft, CheckCircle, AlertOctagon,
  Clock, DollarSign, Activity, Server, ShieldCheck, Zap
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

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `cloud_sim_${simulation.id || 'results'}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
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

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", encodeURI(csvContent));
    downloadAnchor.setAttribute("download", `cloud_sim_telemetry_${simulation.id || 'run'}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
              Results & Academic Analytics: {simulation.name || config.name}
            </h1>
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              Completed in {simulation.executionTimeMs}ms via C++ discrete-event engine | Seed: {config.seed}
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

      {/* Primary KPI Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px'
      }}>
        <MetricCard
          title="Overall Success Rate"
          value={`${s.overall_success_rate_pct.toFixed(1)}%`}
          subtitle={`${s.total_requests_completed} of ${s.total_requests_submitted} finished`}
          icon={CheckCircle}
          color={s.overall_success_rate_pct >= 95 ? 'green' : s.overall_success_rate_pct >= 80 ? 'amber' : 'red'}
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
          value={`${s.sla_compliance_rate_pct.toFixed(1)}%`}
          subtitle={`${s.sla_violation_count} violations (< ${s.sla_target_latency_ms}ms target)`}
          icon={ShieldCheck}
          color={s.sla_compliance_rate_pct >= 95 ? 'green' : 'amber'}
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
        
        {/* Card 1: Latency Distribution */}
        <div className="card">
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            Latency Distribution & Tail Analysis
          </div>
          <table className="data-table" style={{ margin: 0 }}>
            <tbody>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Minimum Latency</td>
                <td className="font-mono" style={{ textAlign: 'right' }}>{s.min_latency_ms.toFixed(1)} ms</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Median (P50)</td>
                <td className="font-mono" style={{ textAlign: 'right', fontWeight: 600 }}>{s.p50_latency_ms.toFixed(1)} ms</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>P90 Tail Latency</td>
                <td className="font-mono" style={{ textAlign: 'right' }}>{s.p90_latency_ms.toFixed(1)} ms</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>P95 Tail Latency</td>
                <td className="font-mono" style={{ textAlign: 'right', color: s.p95_latency_ms > s.sla_target_latency_ms ? '#f87171' : '#60a5fa' }}>
                  {s.p95_latency_ms.toFixed(1)} ms
                </td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>P99 Worst Case</td>
                <td className="font-mono" style={{ textAlign: 'right', color: s.p99_latency_ms > s.sla_target_latency_ms ? '#f87171' : '#60a5fa' }}>
                  {s.p99_latency_ms.toFixed(1)} ms
                </td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Maximum Latency</td>
                <td className="font-mono" style={{ textAlign: 'right' }}>{s.max_latency_ms.toFixed(1)} ms</td>
              </tr>
            </tbody>
          </table>
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
                <td className="font-mono" style={{ textAlign: 'right' }}>{s.avg_mem_utilization.toFixed(1)}%</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Scale-Up Operations</td>
                <td className="font-mono" style={{ textAlign: 'right', color: '#a78bfa' }}>+{s.scale_up_events} events</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--text-secondary)' }}>Scale-Down Operations</td>
                <td className="font-mono" style={{ textAlign: 'right', color: '#fbbf24' }}>-{s.scale_down_events} events</td>
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

      {/* Full-width Telemetry Line Graphs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
        <TelemetryChart
          title="Cluster Utilization Profile (%)"
          data={result.snapshots || []}
          series={[
            { key: 'cpu_util', label: 'CPU Utilization %', color: '#3b82f6' },
            { key: 'mem_util', label: 'Memory Utilization %', color: '#10b981' }
          ]}
          unit="%"
        />
        <TelemetryChart
          title="Throughput & Average Latency"
          data={result.snapshots || []}
          series={[
            { key: 'throughput', label: 'Throughput (req/s)', color: '#38bdf8' },
            { key: 'avg_latency_ms', label: 'Latency (ms)', color: '#fbbf24' }
          ]}
          unit=""
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
