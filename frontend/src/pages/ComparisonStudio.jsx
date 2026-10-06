import React, { useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import { runPolicyExperiment } from '../services/api';
import {
  GitCompare, Award, Play, CheckCircle, AlertTriangle,
  Activity, DollarSign, Clock, Layers, Sliders, ExternalLink,
  ShieldCheck, BarChart2, RefreshCw, Info
} from 'lucide-react';

export default function ComparisonStudio({
  comparisonData,
  simulations = [],
  presets = [],
  onCompareSimulations,
  onSelectSimulation
}) {
  // Mode: 'EXPERIMENT' (workbench running fixed workload on multiple policies) or 'SAVED' (compare previous runs)
  const [activeMode, setActiveMode] = useState('EXPERIMENT');
  const [experimentType, setExperimentType] = useState('SCHEDULING'); // 'SCHEDULING' | 'LOAD_BALANCING' | 'AUTOSCALING'
  const [selectedPresetId, setSelectedPresetId] = useState(presets[0]?.id || 'full_lifecycle');
  const [customSeed, setCustomSeed] = useState(42);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // For SAVED mode multi-selection
  const [selectedSimIds, setSelectedSimIds] = useState(
    comparisonData ? comparisonData.matrix.map(m => m.id) : []
  );

  // Active dataset for comparison: either prop comparisonData or state experimentResult
  const [experimentResult, setExperimentResult] = useState(null);

  const activeData = experimentResult || comparisonData;

  const toggleSelect = (id) => {
    setSelectedSimIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleTriggerSavedCompare = () => {
    if (selectedSimIds.length >= 2) {
      setExperimentResult(null);
      onCompareSimulations(selectedSimIds);
    }
  };

  const handleRunExperiment = async () => {
    setIsRunning(true);
    setErrorMsg(null);
    try {
      const selectedPreset = presets.find(p => p.id === selectedPresetId) || presets[0];
      const baseConfig = selectedPreset ? selectedPreset.config : {
        duration: 30.0,
        initial_nodes: 2,
        seed: Number(customSeed),
        workload: {
          request_rate: 8.0,
          min_task_duration: 1.0,
          max_task_duration: 3.0
        }
      };

      const result = await runPolicyExperiment({
        baseConfig,
        experimentType,
        seed: Number(customSeed)
      });

      setExperimentResult(result);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to execute policy experiment');
    } finally {
      setIsRunning(false);
    }
  };

  const matrix = activeData?.matrix || [];
  const metricTable = activeData?.metricTable || [];
  const ranking = activeData?.ranking || [];
  const insights = activeData?.insights || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Header & Mode Toggle */}
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
          <h1 style={{ fontSize: '16px', fontWeight: 700, color: '#f8fafc', marginBottom: '4px' }}>
            Experimentation & Policy Benchmark Studio
          </h1>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            Conduct controlled, deterministic experiments comparing scheduling algorithms, load balancing policies, and autoscaling elasticity under identical workload conditions.
          </p>
        </div>

        {/* Mode Selector Tabs */}
        <div style={{
          display: 'flex',
          backgroundColor: '#080c16',
          border: '1px solid var(--border-subtle)',
          borderRadius: '4px',
          padding: '2px'
        }}>
          <button
            onClick={() => setActiveMode('EXPERIMENT')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: activeMode === 'EXPERIMENT' ? 600 : 400,
              color: activeMode === 'EXPERIMENT' ? '#ffffff' : 'var(--text-secondary)',
              backgroundColor: activeMode === 'EXPERIMENT' ? '#1e293b' : 'transparent',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Policy Experiment Benchmark
          </button>
          <button
            onClick={() => setActiveMode('SAVED')}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: activeMode === 'SAVED' ? 600 : 400,
              color: activeMode === 'SAVED' ? '#ffffff' : 'var(--text-secondary)',
              backgroundColor: activeMode === 'SAVED' ? '#1e293b' : 'transparent',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer'
            }}
          >
            Compare Saved Runs
          </button>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '4px',
          color: '#f87171',
          fontSize: '13px'
        }}>
          {errorMsg}
        </div>
      )}

      {/* Mode A: Policy Experiment Workbench */}
      {activeMode === 'EXPERIMENT' && (
        <div className="card" style={{ backgroundColor: '#0f172a' }}>
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: '#60a5fa',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Sliders size={15} />
            Configure Controlled Experiment Benchmark
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: '16px',
            marginBottom: '18px'
          }}>
            {/* 1. Experiment Category */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>
                1. Independent Variable (Policy Type)
              </label>
              <select
                value={experimentType}
                onChange={(e) => setExperimentType(e.target.value)}
              >
                <option value="SCHEDULING">Scheduling Algorithms (Round Robin, Least Loaded, Priority, First Fit)</option>
                <option value="LOAD_BALANCING">Load Balancing Strategies (Round Robin, Least Connections, Weighted)</option>
                <option value="AUTOSCALING">Autoscaling Elasticity (No Scaling, Reactive, Aggressive)</option>
              </select>
            </div>

            {/* 2. Base Workload Configuration */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>
                2. Base Workload & Infrastructure
              </label>
              <select
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
              >
                {presets.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.category})</option>
                ))}
              </select>
            </div>

            {/* 3. Deterministic Seed */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px', fontWeight: 600 }}>
                3. Deterministic PRNG Seed
              </label>
              <input
                type="number"
                value={customSeed}
                onChange={(e) => setCustomSeed(e.target.value)}
                min="1"
                max="999999"
              />
            </div>
          </div>

          {/* Workbench Note & Run Button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '14px',
            borderTop: '1px solid var(--border-subtle)',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <Info size={14} color="#60a5fa" />
              <span>
                All variants are simulated using the exact same PRNG seed ({customSeed}), guaranteeing identical arrival timestamps, CPU requirements, and durations for rigorous scientific reproducibility.
              </span>
            </div>

            <button
              className="btn btn-primary"
              onClick={handleRunExperiment}
              disabled={isRunning}
              style={{ minWidth: '200px' }}
            >
              {isRunning ? (
                <>
                  <RefreshCw size={14} className="spin" /> Executing Benchmark...
                </>
              ) : (
                <>
                  <Play size={14} /> Execute Policy Experiment
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Mode B: Saved Simulations Selector */}
      {activeMode === 'SAVED' && (
        <div className="card">
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', marginBottom: '12px' }}>
            Select Simulation Runs to Compare ({selectedSimIds.length} selected)
          </div>

          {simulations.length < 2 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
              You need at least 2 simulation runs to perform a comparison. Run another simulation from the Workload Studio or execute an automated policy experiment above.
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
                    {s.summary ? `${s.summary.overall_throughput_req_per_sec.toFixed(1)} req/s` : 'Completed'}
                  </span>
                </label>
              ))}

              <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary"
                  disabled={selectedSimIds.length < 2}
                  onClick={handleTriggerSavedCompare}
                >
                  <GitCompare size={15} /> Compare Selected Runs
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* RESULTS DISPLAY: Only shown when activeData exists */}
      {matrix.length >= 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* 1. Policy Ranking Leaderboard */}
          {ranking.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Award size={16} color="#3b82f6" />
                <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Policy Performance Ranking & Multi-Objective Evaluation
                </h2>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: '14px'
              }}>
                {ranking.map((item) => (
                  <div
                    key={item.id}
                    className="card"
                    style={{
                      border: item.rank === 1 ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                      backgroundColor: item.rank === 1 ? 'rgba(16, 185, 129, 0.05)' : '#0f172a'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: item.rank === 1 ? '#10b981' : '#334155',
                          color: '#ffffff',
                          fontSize: '11px',
                          fontWeight: 700
                        }}>
                          {item.rank}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#f8fafc' }}>
                          {item.name}
                        </span>
                      </div>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: item.rank === 1 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                        color: item.rank === 1 ? '#34d399' : '#60a5fa'
                      }}>
                        Grade: {item.grade} ({item.score}/100)
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '10px', fontSize: '11px' }}>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>SLA Compliance:</span>
                        <div className="font-mono" style={{ fontWeight: 600, color: item.slaCompliancePct >= 95 ? '#10b981' : '#f59e0b' }}>
                          {item.slaCompliancePct.toFixed(1)}%
                        </div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Avg Latency:</span>
                        <div className="font-mono" style={{ fontWeight: 600, color: '#60a5fa' }}>
                          {item.avgLatencyMs.toFixed(1)} ms
                        </div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Throughput:</span>
                        <div className="font-mono" style={{ fontWeight: 600, color: '#f8fafc' }}>
                          {item.throughputReqSec.toFixed(2)} req/s
                        </div>
                      </div>
                      <div>
                        <span style={{ color: 'var(--text-muted)' }}>Total Cost:</span>
                        <div className="font-mono" style={{ fontWeight: 600, color: '#34d399' }}>
                          ${item.totalCostUsd.toFixed(4)}
                        </div>
                      </div>
                    </div>

                    {onSelectSimulation && (
                      <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', textAlign: 'right' }}>
                        <button
                          onClick={() => onSelectSimulation(item.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#3b82f6',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          View Full Results <ExternalLink size={11} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Viva Defense / Academic Explanations */}
          {insights.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <ShieldCheck size={16} color="#10b981" />
                <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Academic Viva Defense & Architectural Explainability
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
          )}

          {/* 3. Official Side-by-Side Metric Comparison Table (Section 3 Format) */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#0c1322',
              borderBottom: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em'
              }}>
                Side-by-Side Metric Comparison Table (Actual Simulation State)
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                ★ Best value highlighted per metric row
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '200px', backgroundColor: '#0f172a' }}>Metric</th>
                    {matrix.map((col) => (
                      <th key={col.id} style={{ minWidth: '160px', textAlign: 'center' }}>
                        <div style={{ color: '#f8fafc', fontWeight: 600 }}>{col.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>
                          {col.scheduler} | {col.loadBalancer}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metricTable.map((row, rIdx) => (
                    <tr key={rIdx}>
                      <td style={{ fontWeight: 600, color: 'var(--text-secondary)', backgroundColor: '#0a0f1d' }}>
                        {row.metric} {row.unit && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({row.unit})</span>}
                      </td>
                      {matrix.map((col) => {
                        const val = row.values[col.id];
                        const isBest = row.bestVariantId === col.id;
                        return (
                          <td
                            key={col.id}
                            className="font-mono"
                            style={{
                              textAlign: 'center',
                              backgroundColor: isBest ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                              color: isBest ? '#10b981' : '#f8fafc',
                              fontWeight: isBest ? 700 : 400
                            }}
                          >
                            {val ?? '-'}
                            {isBest && <span style={{ fontSize: '11px', color: '#10b981', marginLeft: '6px' }}>★</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Visual Grouped Bar Performance Comparison */}
          <div className="card">
            <div style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <BarChart2 size={16} color="#60a5fa" />
              Comparative Visual Metric Breakdown
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '20px'
            }}>
              {/* Chart 1: Average Latency (Lower is better) */}
              <div style={{ backgroundColor: '#090d16', padding: '14px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Average Response Time (ms)</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Lower is better</span>
                </div>
                {(() => {
                  const maxLat = Math.max(...matrix.map(m => m.avgLatencyMs || 1));
                  const minLat = Math.min(...matrix.map(m => m.avgLatencyMs || 1));
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {matrix.map(m => {
                        const pct = Math.max(8, (m.avgLatencyMs / maxLat) * 100);
                        const isBest = m.avgLatencyMs === minLat;
                        return (
                          <div key={m.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                              <span style={{ color: isBest ? '#34d399' : '#cbd5e1', fontWeight: isBest ? 600 : 400 }}>{m.name}</span>
                              <span className="font-mono" style={{ color: isBest ? '#34d399' : 'var(--text-primary)', fontWeight: 600 }}>
                                {m.avgLatencyMs.toFixed(1)} ms
                              </span>
                            </div>
                            <div style={{ width: '100%', height: '8px', backgroundColor: '#1e293b', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', backgroundColor: isBest ? '#10b981' : '#3b82f6', borderRadius: '2px' }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Chart 2: Throughput (Higher is better) */}
              <div style={{ backgroundColor: '#090d16', padding: '14px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Throughput (req/s)</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Higher is better</span>
                </div>
                {(() => {
                  const maxThru = Math.max(...matrix.map(m => m.throughputReqSec || 1));
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {matrix.map(m => {
                        const pct = Math.max(8, (m.throughputReqSec / maxThru) * 100);
                        const isBest = m.throughputReqSec === maxThru;
                        return (
                          <div key={m.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                              <span style={{ color: isBest ? '#34d399' : '#cbd5e1', fontWeight: isBest ? 600 : 400 }}>{m.name}</span>
                              <span className="font-mono" style={{ color: isBest ? '#34d399' : 'var(--text-primary)', fontWeight: 600 }}>
                                {m.throughputReqSec.toFixed(2)} req/s
                              </span>
                            </div>
                            <div style={{ width: '100%', height: '8px', backgroundColor: '#1e293b', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', backgroundColor: isBest ? '#10b981' : '#6366f1', borderRadius: '2px' }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              {/* Chart 3: SLA Compliance % */}
              <div style={{ backgroundColor: '#090d16', padding: '14px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>SLA Compliance (%)</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Target: &gt; 95%</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {matrix.map(m => {
                    const isBest = m.slaCompliancePct === Math.max(...matrix.map(x => x.slaCompliancePct));
                    return (
                      <div key={m.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                          <span style={{ color: isBest ? '#34d399' : '#cbd5e1', fontWeight: isBest ? 600 : 400 }}>{m.name}</span>
                          <span className="font-mono" style={{ color: isBest ? '#34d399' : 'var(--text-primary)', fontWeight: 600 }}>
                            {m.slaCompliancePct.toFixed(1)}%
                          </span>
                        </div>
                        <div style={{ width: '100%', height: '8px', backgroundColor: '#1e293b', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.min(100, Math.max(5, m.slaCompliancePct))}%`,
                            height: '100%',
                            backgroundColor: m.slaCompliancePct >= 95 ? '#10b981' : m.slaCompliancePct >= 80 ? '#f59e0b' : '#ef4444',
                            borderRadius: '2px'
                          }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chart 4: Total Cost (Lower is better) */}
              <div style={{ backgroundColor: '#090d16', padding: '14px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', marginBottom: '12px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Simulated Infrastructure Cost ($)</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Economic Efficiency</span>
                </div>
                {(() => {
                  const maxCost = Math.max(...matrix.map(m => m.totalCostUsd || 1));
                  const minCost = Math.min(...matrix.map(m => m.totalCostUsd || 1));
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {matrix.map(m => {
                        const pct = Math.max(8, (m.totalCostUsd / maxCost) * 100);
                        const isBest = m.totalCostUsd === minCost;
                        return (
                          <div key={m.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                              <span style={{ color: isBest ? '#34d399' : '#cbd5e1', fontWeight: isBest ? 600 : 400 }}>{m.name}</span>
                              <span className="font-mono" style={{ color: isBest ? '#34d399' : 'var(--text-primary)', fontWeight: 600 }}>
                                ${m.totalCostUsd.toFixed(4)}
                              </span>
                            </div>
                            <div style={{ width: '100%', height: '8px', backgroundColor: '#1e293b', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', backgroundColor: isBest ? '#10b981' : '#0ea5e9', borderRadius: '2px' }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
