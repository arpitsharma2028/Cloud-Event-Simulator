import React, { useState } from 'react';
import { Play, Sparkles, RefreshCw, AlertTriangle, Layers, Cpu, Server, Activity, ShieldAlert, DollarSign } from 'lucide-react';

export default function WorkloadStudio({ presets = [], onRunSimulation, isRunning = false }) {
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [validationError, setValidationError] = useState(null);

  // Form State
  const [config, setConfig] = useState({
    name: "Custom Cloud Workload",
    seed: 42,
    duration: 60.0,
    time_step: 0.5,

    initial_nodes: 3,
    default_cpu_per_node: 8.0,
    default_mem_per_node: 16.0,
    node_queue_limit: 50,

    scheduler: "ROUND_ROBIN",
    load_balancer: "ROUND_ROBIN",

    auto_scaler: {
      enabled: true,
      scale_up_threshold: 75.0,
      scale_down_threshold: 30.0,
      cooldown_period: 15.0,
      min_nodes: 2,
      max_nodes: 8,
      scale_up_step: 1,
      scale_down_step: 1
    },

    workload: {
      request_rate: 10.0,
      min_task_duration: 1.0,
      max_task_duration: 4.0,
      min_cpu: 1.0,
      max_cpu: 2.0,
      min_mem: 1.0,
      max_mem: 4.0,
      priority_high_ratio: 0.2,
      priority_med_ratio: 0.6,
      priority_low_ratio: 0.2
    },

    spikes: [],
    failures: [],

    sla_target_ms: 250.0,
    cost_per_vcpu_hr: 0.048,
    cost_per_gb_hr: 0.006
  });

  const handlePresetChange = (presetId) => {
    setSelectedPresetId(presetId);
    if (!presetId) return;

    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setConfig({
        ...preset.config,
        name: `${preset.name} (${new Date().toLocaleTimeString()})`
      });
      setValidationError(null);
    }
  };

  const handleAddSpike = () => {
    setConfig(prev => ({
      ...prev,
      spikes: [...prev.spikes, { start_time: 20.0, duration: 10.0, additional_requests: 100 }]
    }));
  };

  const handleRemoveSpike = (idx) => {
    setConfig(prev => ({
      ...prev,
      spikes: prev.spikes.filter((_, i) => i !== idx)
    }));
  };

  const handleUpdateSpike = (idx, field, val) => {
    setConfig(prev => {
      const updated = [...prev.spikes];
      updated[idx] = { ...updated[idx], [field]: Number(val) };
      return { ...prev, spikes: updated };
    });
  };

  const handleAddFailure = () => {
    setConfig(prev => ({
      ...prev,
      failures: [...prev.failures, { node_id: 1, fail_time: 20.0, recovery_time: 40.0 }]
    }));
  };

  const handleRemoveFailure = (idx) => {
    setConfig(prev => ({
      ...prev,
      failures: prev.failures.filter((_, i) => i !== idx)
    }));
  };

  const handleUpdateFailure = (idx, field, val) => {
    setConfig(prev => {
      const updated = [...prev.failures];
      updated[idx] = { ...updated[idx], [field]: Number(val) };
      return { ...prev, failures: updated };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError(null);

    // Basic frontend checks
    if (config.auto_scaler.min_nodes > config.auto_scaler.max_nodes) {
      setValidationError("Auto-scaler minimum nodes cannot be greater than maximum nodes.");
      return;
    }
    if (config.workload.min_task_duration > config.workload.max_task_duration) {
      setValidationError("Minimum task duration cannot be greater than maximum task duration.");
      return;
    }

    onRunSimulation(config);
  };

  const SCHEDULER_DESCRIPTIONS = {
    ROUND_ROBIN: "Cycles systematically through all operational nodes regardless of existing load.",
    LEAST_LOADED: "Evaluates composite CPU and Memory utilization on each healthy node and assigns to the node with lowest active load.",
    PRIORITY_BASED: "Evaluates workload priority: assigns high-priority requests to immediate idle capacity, while lower priorities are queued or deferred.",
    FIRST_FIT: "Sequentially scans cluster nodes and places task on the first node with sufficient unallocated CPU and RAM."
  };

  const LB_DESCRIPTIONS = {
    ROUND_ROBIN: "Distributes incoming network connections in alternating circular sequence.",
    LEAST_CONNECTIONS: "Directs traffic to the virtual node with the fewest active concurrent requests.",
    WEIGHTED: "Routes requests proportional to assigned node compute capacity weights."
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header and Preset Bar */}
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
        <div>
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc' }}>
            Workload & Cluster Configuration Studio
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Specify cluster topology, scheduling mechanics, elasticity thresholds, failure schedules, and traffic patterns.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            Load Scenario Preset:
          </span>
          <select
            value={selectedPresetId}
            onChange={(e) => handlePresetChange(e.target.value)}
            style={{ width: '260px', height: '34px', fontSize: '12px' }}
          >
            <option value="">-- Choose Pre-Configured Scenario --</option>
            {presets.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Validation Alert */}
      {validationError && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          color: '#f87171',
          fontSize: '13px'
        }}>
          <AlertTriangle size={16} />
          <span>{validationError}</span>
        </div>
      )}

      {/* Grid of Configuration Sections */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        
        {/* Section 1: Experiment Parameters */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            <Activity size={15} color="#3b82f6" />
            <span style={{ fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Experiment Parameters
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Simulation Run Name
              </label>
              <input
                type="text"
                value={config.name}
                onChange={(e) => setConfig({ ...config, name: e.target.value })}
                required
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Random Seed (PRNG)
                </label>
                <input
                  type="number"
                  value={config.seed}
                  onChange={(e) => setConfig({ ...config, seed: parseInt(e.target.value) || 0 })}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Duration (Seconds)
                </label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  step="5"
                  value={config.duration}
                  onChange={(e) => setConfig({ ...config, duration: parseFloat(e.target.value) || 60 })}
                  required
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Telemetry Sampling Interval (Seconds)
              </label>
              <input
                type="number"
                min="0.1"
                max="2.0"
                step="0.1"
                value={config.time_step}
                onChange={(e) => setConfig({ ...config, time_step: parseFloat(e.target.value) || 0.5 })}
              />
            </div>
          </div>
        </div>

        {/* Section 2: Virtual Cluster Sizing */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            <Server size={15} color="#3b82f6" />
            <span style={{ fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Virtual Cluster Topology
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Initial Nodes Count
                </label>
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={config.initial_nodes}
                  onChange={(e) => setConfig({ ...config, initial_nodes: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Queue Limit per Node
                </label>
                <input
                  type="number"
                  min="5"
                  max="200"
                  value={config.node_queue_limit}
                  onChange={(e) => setConfig({ ...config, node_queue_limit: parseInt(e.target.value) || 50 })}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  vCPU Cores per Node
                </label>
                <input
                  type="number"
                  min="1"
                  max="32"
                  step="1"
                  value={config.default_cpu_per_node}
                  onChange={(e) => setConfig({ ...config, default_cpu_per_node: parseFloat(e.target.value) || 4 })}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  RAM (GB) per Node
                </label>
                <input
                  type="number"
                  min="1"
                  max="64"
                  step="1"
                  value={config.default_mem_per_node}
                  onChange={(e) => setConfig({ ...config, default_mem_per_node: parseFloat(e.target.value) || 8 })}
                />
              </div>
            </div>

            <div style={{ fontSize: '11px', color: 'var(--text-muted)', backgroundColor: '#0c1322', padding: '8px', borderRadius: '4px' }}>
              Cluster Starting Capacity: <span className="font-mono" style={{ color: '#f8fafc' }}>
                {config.initial_nodes * config.default_cpu_per_node} vCPUs, {config.initial_nodes * config.default_mem_per_node} GB RAM
              </span>
            </div>
          </div>
        </div>

        {/* Section 3: Policies (Scheduler & Load Balancer) */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            <Layers size={15} color="#3b82f6" />
            <span style={{ fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Scheduling & Balancing Policies
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Cloud Scheduling Policy
              </label>
              <select
                value={config.scheduler}
                onChange={(e) => setConfig({ ...config, scheduler: e.target.value })}
              >
                <option value="ROUND_ROBIN">Round Robin</option>
                <option value="LEAST_LOADED">Least Loaded (Recommended)</option>
                <option value="PRIORITY_BASED">Priority Based</option>
                <option value="FIRST_FIT">First Fit</option>
              </select>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {SCHEDULER_DESCRIPTIONS[config.scheduler]}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Load Balancing Strategy
              </label>
              <select
                value={config.load_balancer}
                onChange={(e) => setConfig({ ...config, load_balancer: e.target.value })}
              >
                <option value="ROUND_ROBIN">Round Robin</option>
                <option value="LEAST_CONNECTIONS">Least Connections</option>
                <option value="WEIGHTED">Weighted</option>
              </select>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {LB_DESCRIPTIONS[config.load_balancer]}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Elastic Auto-Scaler */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Cpu size={15} color="#3b82f6" />
              <span style={{ fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Elastic Auto-Scaling
              </span>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.auto_scaler.enabled}
                onChange={(e) => setConfig({
                  ...config,
                  auto_scaler: { ...config.auto_scaler, enabled: e.target.checked }
                })}
              />
              <span>Enabled</span>
            </label>
          </div>

          {config.auto_scaler.enabled ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Scale-Up Threshold (%)
                  </label>
                  <input
                    type="number"
                    min="40"
                    max="95"
                    value={config.auto_scaler.scale_up_threshold}
                    onChange={(e) => setConfig({
                      ...config,
                      auto_scaler: { ...config.auto_scaler, scale_up_threshold: parseFloat(e.target.value) || 75 }
                    })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Scale-Down Threshold (%)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="60"
                    value={config.auto_scaler.scale_down_threshold}
                    onChange={(e) => setConfig({
                      ...config,
                      auto_scaler: { ...config.auto_scaler, scale_down_threshold: parseFloat(e.target.value) || 30 }
                    })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Cooldown (s)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="60"
                    value={config.auto_scaler.cooldown_period}
                    onChange={(e) => setConfig({
                      ...config,
                      auto_scaler: { ...config.auto_scaler, cooldown_period: parseFloat(e.target.value) || 15 }
                    })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Min Nodes
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={config.auto_scaler.min_nodes}
                    onChange={(e) => setConfig({
                      ...config,
                      auto_scaler: { ...config.auto_scaler, min_nodes: parseInt(e.target.value) || 1 }
                    })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    Max Nodes
                  </label>
                  <input
                    type="number"
                    min="2"
                    max="16"
                    value={config.auto_scaler.max_nodes}
                    onChange={(e) => setConfig({
                      ...config,
                      auto_scaler: { ...config.auto_scaler, max_nodes: parseInt(e.target.value) || 8 }
                    })}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px', color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px', textAlign: 'center' }}>
              Autoscaling disabled. Cluster will operate at a fixed size of {config.initial_nodes} nodes.
            </div>
          )}
        </div>

        {/* Section 5: Workload Generator */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            <Activity size={15} color="#3b82f6" />
            <span style={{ fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Workload & Traffic Profile
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Request Arrival Rate (Poisson λ req/s)
                </label>
                <input
                  type="number"
                  min="0.5"
                  max="50"
                  step="0.5"
                  value={config.workload.request_rate}
                  onChange={(e) => setConfig({
                    ...config,
                    workload: { ...config.workload, request_rate: parseFloat(e.target.value) || 10 }
                  })}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  Execution Duration (s)
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="number"
                    placeholder="Min"
                    step="0.5"
                    value={config.workload.min_task_duration}
                    onChange={(e) => setConfig({
                      ...config,
                      workload: { ...config.workload, min_task_duration: parseFloat(e.target.value) || 1 }
                    })}
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    step="0.5"
                    value={config.workload.max_task_duration}
                    onChange={(e) => setConfig({
                      ...config,
                      workload: { ...config.workload, max_task_duration: parseFloat(e.target.value) || 4 }
                    })}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  vCPU Requirements (Min - Max)
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="number"
                    step="0.5"
                    value={config.workload.min_cpu}
                    onChange={(e) => setConfig({
                      ...config,
                      workload: { ...config.workload, min_cpu: parseFloat(e.target.value) || 1 }
                    })}
                  />
                  <input
                    type="number"
                    step="0.5"
                    value={config.workload.max_cpu}
                    onChange={(e) => setConfig({
                      ...config,
                      workload: { ...config.workload, max_cpu: parseFloat(e.target.value) || 2 }
                    })}
                  />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                  RAM GB Requirements (Min - Max)
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <input
                    type="number"
                    step="0.5"
                    value={config.workload.min_mem}
                    onChange={(e) => setConfig({
                      ...config,
                      workload: { ...config.workload, min_mem: parseFloat(e.target.value) || 1 }
                    })}
                  />
                  <input
                    type="number"
                    step="0.5"
                    value={config.workload.max_mem}
                    onChange={(e) => setConfig({
                      ...config,
                      workload: { ...config.workload, max_mem: parseFloat(e.target.value) || 4 }
                    })}
                  />
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Priority Breakdown: P1 High ({Math.round(config.workload.priority_high_ratio * 100)}%), P2 Normal ({Math.round(config.workload.priority_med_ratio * 100)}%), P3 Low ({Math.round(config.workload.priority_low_ratio * 100)}%)
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={config.workload.priority_high_ratio}
                  onChange={(e) => setConfig({
                    ...config,
                    workload: { ...config.workload, priority_high_ratio: parseFloat(e.target.value) || 0 }
                  })}
                  title="P1 High Ratio"
                />
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={config.workload.priority_med_ratio}
                  onChange={(e) => setConfig({
                    ...config,
                    workload: { ...config.workload, priority_med_ratio: parseFloat(e.target.value) || 0 }
                  })}
                  title="P2 Normal Ratio"
                />
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={config.workload.priority_low_ratio}
                  onChange={(e) => setConfig({
                    ...config,
                    workload: { ...config.workload, priority_low_ratio: parseFloat(e.target.value) || 0 }
                  })}
                  title="P3 Low Ratio"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 6: Chaos & SLA Modeling */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            <ShieldAlert size={15} color="#3b82f6" />
            <span style={{ fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Chaos Failures, Spikes & SLA
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {/* Failures List */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Node Failure Injections ({config.failures.length})</span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                  onClick={handleAddFailure}
                >
                  + Add Outage
                </button>
              </div>

              {config.failures.map((f, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>Node:</span>
                  <input
                    type="number"
                    style={{ width: '50px', padding: '4px', height: '26px', fontSize: '11px' }}
                    value={f.node_id}
                    onChange={(e) => handleUpdateFailure(idx, 'node_id', e.target.value)}
                  />
                  <span style={{ fontSize: '10px', color: '#64748b' }}>Fail @</span>
                  <input
                    type="number"
                    style={{ width: '60px', padding: '4px', height: '26px', fontSize: '11px' }}
                    value={f.fail_time}
                    onChange={(e) => handleUpdateFailure(idx, 'fail_time', e.target.value)}
                  />
                  <span style={{ fontSize: '10px', color: '#64748b' }}>Recov @</span>
                  <input
                    type="number"
                    style={{ width: '60px', padding: '4px', height: '26px', fontSize: '11px' }}
                    value={f.recovery_time}
                    onChange={(e) => handleUpdateFailure(idx, 'recovery_time', e.target.value)}
                  />
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px' }}
                    onClick={() => handleRemoveFailure(idx)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* Spikes List */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Traffic Surges / Spikes ({config.spikes.length})</span>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '2px 8px', fontSize: '10px' }}
                  onClick={handleAddSpike}
                >
                  + Add Spike
                </button>
              </div>

              {config.spikes.map((s, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>Start @</span>
                  <input
                    type="number"
                    style={{ width: '60px', padding: '4px', height: '26px', fontSize: '11px' }}
                    value={s.start_time}
                    onChange={(e) => handleUpdateSpike(idx, 'start_time', e.target.value)}
                  />
                  <span style={{ fontSize: '10px', color: '#64748b' }}>Duration:</span>
                  <input
                    type="number"
                    style={{ width: '50px', padding: '4px', height: '26px', fontSize: '11px' }}
                    value={s.duration}
                    onChange={(e) => handleUpdateSpike(idx, 'duration', e.target.value)}
                  />
                  <span style={{ fontSize: '10px', color: '#64748b' }}>+Reqs:</span>
                  <input
                    type="number"
                    style={{ width: '60px', padding: '4px', height: '26px', fontSize: '11px' }}
                    value={s.additional_requests}
                    onChange={(e) => handleUpdateSpike(idx, 'additional_requests', e.target.value)}
                  />
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '13px' }}
                    onClick={() => handleRemoveSpike(idx)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {/* SLA Target */}
            <div>
              <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Target SLA Latency Threshold (ms)
              </label>
              <input
                type="number"
                min="50"
                max="5000"
                step="50"
                value={config.sla_target_ms}
                onChange={(e) => setConfig({ ...config, sla_target_ms: parseFloat(e.target.value) || 250 })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Submit Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '16px 20px',
        backgroundColor: '#0c1322',
        border: '1px solid var(--border-subtle)',
        borderRadius: '6px',
        gap: '12px'
      }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => handlePresetChange('steady_state')}
        >
          <RefreshCw size={14} />
          Reset to Baseline
        </button>

        <button
          type="submit"
          className="btn btn-primary"
          style={{ padding: '10px 24px', fontSize: '14px', fontWeight: 600 }}
          disabled={isRunning}
        >
          {isRunning ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              Executing in C++ Engine...
            </>
          ) : (
            <>
              <Play size={16} />
              Execute Simulation Run
            </>
          )}
        </button>
      </div>
    </form>
  );
}
