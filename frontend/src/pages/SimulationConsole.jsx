import React, { useState, useEffect, useRef, useMemo } from 'react';
import MetricCard from '../components/MetricCard';
import NodeGrid from '../components/NodeGrid';
import TelemetryChart from '../components/TelemetryChart';
import EventTable from '../components/EventTable';
import DecisionLog from '../components/DecisionLog';
import StatusBadge from '../components/StatusBadge';
import RequestFlowExplainer from '../components/RequestFlowExplainer';
import {
  Play, Pause, RotateCcw, FastForward, Activity,
  Server, Cpu, Layers, ShieldAlert, BarChart2, CheckCircle2, Clock3
} from 'lucide-react';

export default function SimulationConsole({
  simulation,
  onNavigateToResults
}) {
  if (!simulation || !simulation.result) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
        No active simulation loaded. Launch a scenario from the Workload Studio or select a past run from the Dashboard.
      </div>
    );
  }

  const { result, config } = simulation;
  const snapshots = result.snapshots || [];
  const totalSnapshots = snapshots.length;

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 5x, 10x
  const [activeTab, setActiveTab] = useState('trace'); // 'trace' or 'events'

  const timerRef = useRef(null);

  // Auto-play effect
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.max(10, (config.time_step || 0.5) * 1000 / playbackSpeed);
      timerRef.current = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= totalSnapshots - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed, totalSnapshots, config.time_step]);

  const currentSnapshot = snapshots[currentIndex] || {
    timestamp: 0,
    cpu_util: 0,
    mem_util: 0,
    active_nodes: config.initial_nodes,
    healthy_nodes: config.initial_nodes,
    active_tasks: 0,
    queued_tasks: 0,
    completed_tasks: 0,
    throughput: 0,
    avg_latency_ms: 0
  };

  const visibleSnapshots = snapshots.slice(0, currentIndex + 1);
  const currentSimTime = currentSnapshot.timestamp || 0;

  // Pre-parse traces once to prevent costly regex allocations on every tick
  const parsedTraces = useMemo(() => {
    return (result.decision_trace || []).map(t => {
      const match = t.match(/\[T=([\d.]+)s\]/);
      return {
        text: t,
        time: match ? parseFloat(match[1]) : 0,
        isRouting: /ALLOC:|Selected\s+node-/i.test(t)
      };
    });
  }, [result.decision_trace]);

  // Fast slice for currentSimTime
  const visibleTraces = useMemo(() => {
    let count = 0;
    while (count < parsedTraces.length && parsedTraces[count].time <= currentSimTime) {
      count++;
    }
    return parsedTraces.slice(0, count).map(p => p.text);
  }, [parsedTraces, currentSimTime]);

  const latestTrace = visibleTraces[visibleTraces.length - 1] || '';
  const latestRoutingTrace = useMemo(() => {
    for (let i = visibleTraces.length - 1; i >= 0; i--) {
      if (/ALLOC:|Selected\s+node-/i.test(visibleTraces[i])) {
        return visibleTraces[i];
      }
    }
    return latestTrace;
  }, [visibleTraces, latestTrace]);

  const visibleEvents = useMemo(() => {
    const events = result.event_log || [];
    let count = 0;
    while (count < events.length && events[count].timestamp <= currentSimTime) {
      count++;
    }
    return events.slice(0, count);
  }, [result.event_log, currentSimTime]);

  // Identify nodes that newly scaled up or recovered within the last 4 simulation seconds
  const highlightedNodeIds = useMemo(() => {
    const ids = new Set();
    (result.scaling_events || []).forEach(ev => {
      if (ev.action === 'SCALE_UP' && ev.timestamp <= currentSimTime && currentSimTime - ev.timestamp <= 4.0) {
        for (let id = (ev.prev_count || 1) + 1; id <= (ev.new_count || 1); id++) {
          ids.add(id);
        }
      }
    });
    (result.failure_events || []).forEach(ev => {
      if (ev.action === 'NODE_RECOVER' && ev.timestamp <= currentSimTime && currentSimTime - ev.timestamp <= 4.0) {
        ids.add(ev.node_id);
      }
    });
    return ids;
  }, [result.scaling_events, result.failure_events, currentSimTime]);

  // Reference lines for autoscaling thresholds on utilization chart
  const scaleUpThreshold = config.auto_scaler?.enabled ? config.auto_scaler.scale_up_threshold : (config.autoScaler?.enabled ? config.autoScaler.scale_up_threshold : null);
  const scaleDownThreshold = config.auto_scaler?.enabled ? config.auto_scaler.scale_down_threshold : (config.autoScaler?.enabled ? config.autoScaler.scale_down_threshold : null);

  const utilReferenceLines = useMemo(() => {
    const lines = [];
    if (scaleUpThreshold != null) {
      lines.push({ y: scaleUpThreshold, label: `Scale-Up (${scaleUpThreshold}%)`, color: '#ef4444' });
    }
    if (scaleDownThreshold != null) {
      lines.push({ y: scaleDownThreshold, label: `Scale-Down (${scaleDownThreshold}%)`, color: '#10b981' });
    }
    return lines;
  }, [scaleUpThreshold, scaleDownThreshold]);

  const dynamicNodes = currentSnapshot.nodes || [];
  const progressPct = config.duration > 0 ? Math.min(100, (currentSimTime / config.duration) * 100) : 0;

  // Single consolidated active routing policy
  const activePolicyName = (config.load_balancer && config.load_balancer !== 'NONE')
    ? `LB (${config.load_balancer})`
    : `Scheduler (${config.scheduler})`;

  // Dynamic SLA Evaluation for KPI Card
  const avgLatency = currentSnapshot.avg_latency_ms || 0;
  const slaTarget = config.sla_target_ms || 250;
  const isSlaBreached = currentSnapshot.completed_tasks > 0 && avgLatency > slaTarget;
  const isSlaAtRisk = currentSnapshot.completed_tasks > 0 && !isSlaBreached && (avgLatency > 0.8 * slaTarget || currentSnapshot.queued_tasks > 5);

  const slaStatusColor = currentSnapshot.completed_tasks === 0 ? 'blue' :
    isSlaBreached ? 'red' :
    isSlaAtRisk ? 'amber' : 'green';

  const slaSubtitle = currentSnapshot.completed_tasks === 0
    ? 'No completed requests yet'
    : isSlaBreached
      ? `Breached target of ${slaTarget}ms`
      : isSlaAtRisk
        ? `Approaching ${slaTarget}ms target`
        : `✓ Within the ${slaTarget}ms target`;

  const totalSubmittedRequests = result.summary?.total_requests_submitted || (result.event_log?.length || 0);
  const engineExecutionMs = simulation.executionTimeMs != null ? Number(simulation.executionTimeMs).toFixed(1) : '1.2';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Control Deck Header with Inline Expanded Timeline Scrubber */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 18px',
        backgroundColor: '#0c1322',
        border: '1px solid var(--border-subtle)',
        borderRadius: '6px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        {/* Info */}
        <div style={{ minWidth: '240px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
            <h1 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
              {simulation.name || config.name}
            </h1>
            <span className="status-badge status-badge-blue">REPLAY MODE</span>
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <span>Simulated <strong style={{ color: '#f8fafc' }}>{totalSubmittedRequests}</strong> requests in <strong style={{ color: '#34d399' }}>{engineExecutionMs} ms</strong> via C++14 DES</span>
            <span>Policy: <strong style={{ color: '#60a5fa' }}>{activePolicyName}</strong></span>
            <span>Seed: <strong style={{ color: '#94a3b8' }}>{config.seed}</strong></span>
          </div>
        </div>

        {/* Timeline Scrubber (Expanded horizontally in the freed toolbar space) */}
        <div style={{ flex: '1 1 280px', minWidth: '220px', padding: '0 4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Simulation Clock (DES)
            </span>
            <span className="font-mono" style={{ fontSize: '12px', fontWeight: 700, color: '#60a5fa' }}>
              T = {currentSimTime.toFixed(2)}s / {config.duration.toFixed(2)}s ({progressPct.toFixed(0)}%)
            </span>
          </div>
          <input
            type="range"
            min="0"
            max={Math.max(0, totalSnapshots - 1)}
            value={currentIndex}
            onChange={(e) => {
              setIsPlaying(false);
              setCurrentIndex(Number(e.target.value));
            }}
            style={{ width: '100%', cursor: 'pointer', accentColor: '#3b82f6' }}
          />
        </div>

        {/* Playback Controls (Without redundant Full Analytics button) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => { setIsPlaying(false); setCurrentIndex(0); }}
            title="Reset to beginning"
            style={{ padding: '6px 10px' }}
          >
            <RotateCcw size={14} />
          </button>

          <button
            className={isPlaying ? "btn btn-secondary" : "btn btn-primary"}
            onClick={() => {
              if (currentIndex >= totalSnapshots - 1) setCurrentIndex(0);
              setIsPlaying(!isPlaying);
            }}
            style={{ minWidth: '88px', padding: '6px 14px' }}
          >
            {isPlaying ? <><Pause size={14} /> Pause</> : <><Play size={14} /> Play</>}
          </button>

          <button
            className="btn btn-secondary"
            onClick={() => setCurrentIndex(prev => Math.min(totalSnapshots - 1, prev + 1))}
            disabled={isPlaying || currentIndex >= totalSnapshots - 1}
            title="Step 1 tick forward"
            style={{ padding: '6px 10px' }}
          >
            <FastForward size={14} />
          </button>

          <select
            value={playbackSpeed}
            onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
            style={{ width: '80px', height: '32px', fontSize: '11px', padding: '4px' }}
          >
            <option value="1">1x Speed</option>
            <option value="2">2x Speed</option>
            <option value="5">5x Speed</option>
            <option value="10">10x Speed</option>
          </select>
        </div>
      </div>

      {/* 2-Column Bento Layout on Desktop */}
      <div className="console-bento-grid">
        {/* LEFT COLUMN (~58% width): Node Pool, Flow Explainer, & Core KPIs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <RequestFlowExplainer
            snapshot={currentSnapshot}
            nodes={dynamicNodes}
            trace={latestRoutingTrace}
            slaTarget={config.sla_target_ms}
            policyName={activePolicyName}
          />

          {/* Primary Quick KPIs */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '12px'
          }}>
            <MetricCard
              title="Servers available"
              value={currentSnapshot.healthy_nodes}
              unit={`/ ${currentSnapshot.active_nodes} total`}
              subtitle="Servers ready to accept work"
              icon={Server}
              color="blue"
            />
            <MetricCard
              title="Requests being handled"
              value={currentSnapshot.active_tasks}
              unit="now"
              subtitle={currentSnapshot.queued_tasks > 0 ? `${currentSnapshot.queued_tasks} waiting in queue` : 'Queue is empty'}
              icon={Activity}
              color={currentSnapshot.queued_tasks > 0 ? 'amber' : 'blue'}
            />
            <MetricCard
              title="Response-time check"
              value={currentSnapshot.completed_tasks === 0 ? 'N/A' : `${avgLatency.toFixed(1)}`}
              unit="ms"
              subtitle={slaSubtitle}
              icon={ShieldAlert}
              alert={isSlaBreached}
              color={slaStatusColor}
            />
          </div>

          <details className="card" style={{ padding: '10px 14px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '11px', color: 'var(--text-secondary)' }}>Show technical metrics: CPU, RAM, and throughput</summary>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginTop: '12px' }}>
              <MetricCard title="Cluster CPU use" value={`${currentSnapshot.cpu_util.toFixed(1)}%`} subtitle="Mean active core usage" icon={Cpu} color={currentSnapshot.cpu_util > 80 ? 'red' : 'blue'} />
              <MetricCard title="Cluster RAM use" value={`${currentSnapshot.mem_util.toFixed(1)}%`} subtitle="Allocated memory pool" icon={Layers} color="green" />
              <MetricCard title="Throughput" value={currentSnapshot.throughput.toFixed(1)} unit="req/s" subtitle="1-second rolling completions" icon={Activity} color="green" />
            </div>
          </details>

          {/* Virtual Node Pool */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <h2 style={{ fontSize: '12px', fontWeight: 700, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Cluster Virtual Node Pool ({dynamicNodes.length} nodes)
              </h2>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Real-time capacity, allocation, and queue depth
              </span>
            </div>
            <NodeGrid
              nodes={dynamicNodes}
              selectedNodeId={Number((latestRoutingTrace.match(/->\s*node-(\d+)/i) || latestRoutingTrace.match(/Selected\s+node-(\d+)/i))?.[1]) || null}
              highlightedNodeIds={highlightedNodeIds}
            />
            {!currentSnapshot.nodes && <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>This older run has no historical node snapshots. Run it again with the rebuilt engine.</p>}
          </div>
        </div>

        {/* RIGHT COLUMN (~42% width): Stacked Compact Charts & Scrollable Trace */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* Chart 1: Cluster Utilization with Autoscaling Threshold Reference Lines */}
          <TelemetryChart
            title="Cluster Utilization (%)"
            data={visibleSnapshots}
            series={[
              { key: 'cpu_util', label: 'CPU Util %', color: '#3b82f6' },
              { key: 'mem_util', label: 'RAM Util %', color: '#10b981' }
            ]}
            referenceLines={utilReferenceLines}
            unit="%"
            totalDuration={config.duration}
          />

          {/* Chart 2: Active Instances & Throughput with Dual Y-Axes */}
          <TelemetryChart
            title="Active Instances & Throughput"
            data={visibleSnapshots}
            series={[
              { key: 'active_nodes', label: 'Active Nodes', color: '#a78bfa' },
              { key: 'throughput', label: 'Throughput (req/s)', color: '#38bdf8' }
            ]}
            unit=""
            dualAxis={true}
            totalDuration={config.duration}
          />

          {/* Live Decision Trace & Discrete Event Log Feed */}
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <button
                className={`btn ${activeTab === 'trace' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '11px', padding: '5px 10px' }}
                onClick={() => setActiveTab('trace')}
              >
                Decision Trace ({visibleTraces.length})
              </button>
              <button
                className={`btn ${activeTab === 'events' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '11px', padding: '5px 10px' }}
                onClick={() => setActiveTab('events')}
              >
                Event Log ({visibleEvents.length})
              </button>
            </div>

            {activeTab === 'trace' ? (
              <DecisionLog traces={visibleTraces} maxHeight="250px" />
            ) : (
              <EventTable events={visibleEvents} maxHeight="250px" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
