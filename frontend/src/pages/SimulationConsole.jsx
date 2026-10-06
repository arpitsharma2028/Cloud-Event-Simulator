import React, { useState, useEffect, useRef } from 'react';
import MetricCard from '../components/MetricCard';
import NodeGrid from '../components/NodeGrid';
import TelemetryChart from '../components/TelemetryChart';
import EventTable from '../components/EventTable';
import DecisionLog from '../components/DecisionLog';
import StatusBadge from '../components/StatusBadge';
import {
  Play, Pause, RotateCcw, FastForward, Activity,
  Server, Cpu, Layers, ShieldAlert, BarChart2
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
  const [currentIndex, setCurrentIndex] = useState(totalSnapshots > 0 ? totalSnapshots - 1 : 0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1); // 1x, 2x, 5x
  const [activeTab, setActiveTab] = useState('trace'); // 'trace' or 'events'

  const timerRef = useRef(null);

  // Auto-play effect
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.max(50, 400 / playbackSpeed);
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
  }, [isPlaying, playbackSpeed, totalSnapshots]);

  const currentSnapshot = snapshots[currentIndex] || {
    timestamp: 0,
    cpu_util: 0,
    mem_util: 0,
    active_nodes: config.initial_nodes,
    healthy_nodes: config.initial_nodes,
    active_tasks: 0,
    queued_tasks: 0,
    throughput: 0,
    avg_latency_ms: 0
  };

  const visibleSnapshots = snapshots.slice(0, currentIndex + 1);

  // Filter events up to current simulation time
  const currentSimTime = currentSnapshot.timestamp || 0;
  const visibleEvents = (result.event_log || []).filter(e => e.timestamp <= currentSimTime);
  const visibleTraces = (result.decision_trace || []).filter(t => {
    const match = t.match(/\[T=([\d.]+)s\]/);
    if (match) {
      return parseFloat(match[1]) <= currentSimTime;
    }
    return true;
  });

  // Calculate dynamic node states for the current snapshot
  // If at final index, show final nodes; otherwise compute proportion
  const dynamicNodes = (result.nodes || []).map((node, i) => {
    // If current time is within failure window, mark failed
    const hasActiveFailure = (config.failures || []).some(
      f => f.node_id === node.id && currentSimTime >= f.fail_time && currentSimTime < f.recovery_time
    );

    if (hasActiveFailure) {
      return {
        ...node,
        status: 'FAILED',
        cpu_used: 0,
        mem_used: 0,
        cpu_util: 0,
        mem_util: 0,
        active_tasks: 0,
        queued_tasks: 0
      };
    }

    // Interpolate load based on current snapshot
    const ratio = totalSnapshots > 0 ? (currentIndex + 1) / totalSnapshots : 1;
    const cpuUtil = Math.min(100, (currentSnapshot.cpu_util * (0.8 + (i % 3) * 0.15)));
    const memUtil = Math.min(100, (currentSnapshot.mem_util * (0.85 + (i % 2) * 0.15)));

    return {
      ...node,
      cpu_util: cpuUtil,
      mem_util: memUtil,
      cpu_used: (node.cpu_capacity * cpuUtil) / 100,
      mem_used: (node.mem_capacity * memUtil) / 100,
      active_tasks: Math.round(currentSnapshot.active_tasks / Math.max(1, currentSnapshot.active_nodes)),
      queued_tasks: Math.round(currentSnapshot.queued_tasks / Math.max(1, currentSnapshot.active_nodes)),
      status: cpuUtil > 90 ? 'OVERLOADED' : cpuUtil > 60 ? 'BUSY' : cpuUtil > 0 ? 'HEALTHY' : 'IDLE'
    };
  });

  const progressPct = config.duration > 0 ? Math.min(100, (currentSimTime / config.duration) * 100) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Control Deck */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        backgroundColor: '#0c1322',
        border: '1px solid var(--border-subtle)',
        borderRadius: '6px',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        {/* Info */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
              {simulation.name || config.name}
            </h1>
            <StatusBadge status={simulation.status} />
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', gap: '12px' }}>
            <span>Policy: <strong style={{ color: '#60a5fa' }}>{config.scheduler}</strong></span>
            <span>LB: <strong style={{ color: '#60a5fa' }}>{config.load_balancer}</strong></span>
            <span>Seed: <strong style={{ color: '#94a3b8' }}>{config.seed}</strong></span>
          </div>
        </div>

        {/* Playback Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
            style={{ minWidth: '90px', padding: '6px 14px' }}
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

          <button
            className="btn btn-secondary"
            onClick={onNavigateToResults}
            style={{ marginLeft: '8px' }}
          >
            <BarChart2 size={14} />
            Full Analytics
          </button>
        </div>
      </div>

      {/* Timeline Scrubber */}
      <div className="card" style={{ padding: '12px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Simulation Clock (DES Virtual Time)
          </span>
          <span className="font-mono" style={{ fontSize: '13px', fontWeight: 700, color: '#60a5fa' }}>
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

      {/* Real-Time Live Telemetry Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '14px'
      }}>
        <MetricCard
          title="Cluster CPU Utilization"
          value={`${currentSnapshot.cpu_util.toFixed(1)}%`}
          unit=""
          subtitle="Mean active core usage"
          icon={Cpu}
          color={currentSnapshot.cpu_util > 80 ? 'red' : 'blue'}
        />
        <MetricCard
          title="Cluster RAM Utilization"
          value={`${currentSnapshot.mem_util.toFixed(1)}%`}
          unit=""
          subtitle="Allocated memory pool"
          icon={Layers}
          color="green"
        />
        <MetricCard
          title="Operational Nodes"
          value={currentSnapshot.healthy_nodes}
          unit={`/ ${currentSnapshot.active_nodes} total`}
          subtitle="Virtual instances online"
          icon={Server}
          color="blue"
        />
        <MetricCard
          title="Active Workloads"
          value={currentSnapshot.active_tasks}
          unit="tasks"
          subtitle={`${currentSnapshot.queued_tasks} queued tasks`}
          icon={Activity}
          color={currentSnapshot.queued_tasks > 0 ? 'amber' : 'blue'}
        />
        <MetricCard
          title="Throughput"
          value={currentSnapshot.throughput.toFixed(1)}
          unit="req/s"
          subtitle="Simulation processing rate"
          icon={Activity}
          color="green"
        />
        <MetricCard
          title="Recent Avg Latency"
          value={currentSnapshot.avg_latency_ms.toFixed(1)}
          unit="ms"
          subtitle={`SLA threshold: ${config.sla_target_ms}ms`}
          icon={ShieldAlert}
          color={currentSnapshot.avg_latency_ms > config.sla_target_ms ? 'red' : 'blue'}
        />
      </div>

      {/* Cluster Virtual Node Cards */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Cluster Virtual Node Pool ({dynamicNodes.length} nodes)
          </h2>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Dynamic CPU & RAM allocation and queue depth
          </span>
        </div>
        <NodeGrid nodes={dynamicNodes} />
      </div>

      {/* Live Dual Telemetry Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '20px' }}>
        <TelemetryChart
          title="Cluster Utilization (%)"
          data={visibleSnapshots}
          series={[
            { key: 'cpu_util', label: 'CPU Util %', color: '#3b82f6' },
            { key: 'mem_util', label: 'RAM Util %', color: '#10b981' }
          ]}
          unit="%"
        />
        <TelemetryChart
          title="Active Instances & Throughput"
          data={visibleSnapshots}
          series={[
            { key: 'active_nodes', label: 'Active Nodes', color: '#a78bfa' },
            { key: 'throughput', label: 'Throughput (req/s)', color: '#38bdf8' }
          ]}
          unit=""
        />
      </div>

      {/* Tabs: Decision Trace vs Event Table */}
      <div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <button
            className={`btn ${activeTab === 'trace' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '12px', padding: '6px 12px' }}
            onClick={() => setActiveTab('trace')}
          >
            Chronological Decision Trace ({visibleTraces.length})
          </button>
          <button
            className={`btn ${activeTab === 'events' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '12px', padding: '6px 12px' }}
            onClick={() => setActiveTab('events')}
          >
            Discrete Event Log ({visibleEvents.length})
          </button>
        </div>

        {activeTab === 'trace' ? (
          <DecisionLog traces={visibleTraces} />
        ) : (
          <EventTable events={visibleEvents} />
        )}
      </div>
    </div>
  );
}
