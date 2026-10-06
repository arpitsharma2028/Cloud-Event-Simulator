import React from 'react';
import { X, BookOpen, Cpu, ShieldCheck, Activity, DollarSign, RefreshCw, AlertTriangle } from 'lucide-react';

export default function ModelReferenceModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(5, 8, 16, 0.85)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#0c1322',
        border: '1px solid var(--border-subtle)',
        borderRadius: '6px',
        width: '100%',
        maxWidth: '860px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#0f172a'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <BookOpen size={18} color="#3b82f6" />
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f8fafc' }}>
                Simulation Assumptions & Metric Definitions Reference
              </h2>
              <p style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                Mathematical foundations and behavioral modeling of the C++ discrete-event engine
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content Scrollable Area */}
        <div style={{ padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Section 1: Core System Assumptions */}
          <div className="card" style={{ backgroundColor: '#11192d' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#60a5fa', fontWeight: 600, fontSize: '13px' }}>
              <Cpu size={16} />
              1. Simulation Architecture & Core Assumptions
            </div>
            <ul style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: '18px' }}>
              <li><strong>Cloud Behavior Model:</strong> This is an algorithmic cloud behavior simulator. It models discrete-event queue dynamics and scheduling policies; it does NOT provision live AWS/Azure/GCP infrastructure.</li>
              <li><strong>Virtual Node Resources:</strong> Each node represents a virtual compute instance with fixed vCPU capacity and Memory (GB) capacity. Resources are allocated exclusively to active workloads and strictly restored upon task completion or node eviction.</li>
              <li><strong>Bounded Node Queuing:</strong> Each node has a finite waiting queue. If a node is at full capacity and its queue limit is reached, incoming requests are rejected with backpressure (HTTP 429 / Queue Saturated).</li>
              <li><strong>Determinism:</strong> All stochastic arrivals, durations, and sizes are driven by a Mersenne Twister (<code>std::mt19937</code>) PRNG. Identical seeds guarantee 100% byte-for-byte reproducible outcomes across test runs.</li>
            </ul>
          </div>

          {/* Section 2: Mathematical Metric Definitions */}
          <div className="card" style={{ backgroundColor: '#11192d' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', color: '#10b981', fontWeight: 600, fontSize: '13px' }}>
              <Activity size={16} />
              2. Mathematical Formulas & Metric Definitions
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '12px' }}>
              <div style={{ padding: '10px 12px', backgroundColor: '#090d16', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>Response Time (End-to-End Latency)</div>
                <code style={{ fontSize: '11px', color: '#38bdf8', display: 'block', marginBottom: '4px' }}>
                  Response Time = Completion Time - Arrival Time
                </code>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Decomposes into: <code>Response Time = Queue Wait Time + Execution Duration</code>.
                </div>
              </div>

              <div style={{ padding: '10px 12px', backgroundColor: '#090d16', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>Queue Waiting Time</div>
                <code style={{ fontSize: '11px', color: '#38bdf8', display: 'block', marginBottom: '4px' }}>
                  Queue Wait Time = Task Start Time - Arrival Time
                </code>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Measures the elapsed delay a task spends waiting in a node queue before compute resources become available.
                </div>
              </div>

              <div style={{ padding: '10px 12px', backgroundColor: '#090d16', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>Throughput (req/s)</div>
                <code style={{ fontSize: '11px', color: '#38bdf8', display: 'block', marginBottom: '4px' }}>
                  Throughput = Completed Requests / Total Simulation Time
                </code>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Calculated using discrete completed tasks over simulation elapsed seconds.
                </div>
              </div>

              <div style={{ padding: '10px 12px', backgroundColor: '#090d16', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>Composite Node Utilization</div>
                <code style={{ fontSize: '11px', color: '#38bdf8', display: 'block', marginBottom: '4px' }}>
                  U_comp = (0.60 * CPU_Util) + (0.40 * Mem_Util)
                </code>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Prevents multidimensional skew where high memory usage triggers scaling even if CPU is modest.
                </div>
              </div>

              <div style={{ padding: '10px 12px', backgroundColor: '#090d16', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>SLA Compliance & Violations</div>
                <code style={{ fontSize: '11px', color: '#38bdf8', display: 'block', marginBottom: '4px' }}>
                  Violation: Response Time &gt; SLA Target (ms)
                </code>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  SLA Compliance Rate = (Compliant Completed Requests / Total Completed Requests) * 100%.
                </div>
              </div>

              <div style={{ padding: '10px 12px', backgroundColor: '#090d16', border: '1px solid var(--border-subtle)', borderRadius: '4px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>Simulated Infrastructure Cost</div>
                <code style={{ fontSize: '11px', color: '#38bdf8', display: 'block', marginBottom: '4px' }}>
                  Cost = (vCPU-hours * $0.048) + (RAM-GB-hours * $0.006)
                </code>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Models cloud provider per-second instance billing for all active operational virtual nodes.
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Autoscaling & Failure Lifecycle */}
          <div className="card" style={{ backgroundColor: '#11192d' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', color: '#f59e0b', fontWeight: 600, fontSize: '13px' }}>
              <RefreshCw size={16} />
              3. Elasticity & Chaos Failure Semantics
            </div>
            <ul style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, paddingLeft: '18px' }}>
              <li><strong>Horizontal Scale-Up:</strong> Evaluated periodically. If cluster composite load exceeds <code>scale_up_threshold</code> and cooldown has expired, the engine spins up new virtual nodes up to <code>max_nodes</code>.</li>
              <li><strong>Horizontal Scale-Down:</strong> If cluster load drops below <code>scale_down_threshold</code>, the lowest-loaded healthy nodes are safely drained and removed down to <code>min_nodes</code>.</li>
              <li><strong>Cooldown Hysteresis:</strong> Enforces a deadband window (e.g. 10-15s) following any scaling operation to prevent thrashing oscillation.</li>
              <li><strong>Node Failure & Eviction:</strong> When a node suffers catastrophic failure, its status transitions to <code>FAILED</code>. All running and queued workloads on that node are evicted and marked <code>FAILED</code>. Schedulers immediately bypass offline nodes.</li>
              <li><strong>Automated Recovery:</strong> On recovery timestamp, the node reboots, resets resource pools to clean zero load, and re-registers into the healthy scheduling cluster.</li>
            </ul>
          </div>

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: '#0f172a'
        }}>
          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: '12px' }}>
            Close Reference
          </button>
        </div>
      </div>
    </div>
  );
}
