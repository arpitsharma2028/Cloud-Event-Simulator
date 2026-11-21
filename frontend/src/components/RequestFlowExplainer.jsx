import React from 'react';
import { ArrowRight, CheckCircle2, Clock3, Server, ShieldAlert, Workflow, Target } from 'lucide-react';

const outcomeFor = (snapshot, slaTarget) => {
  if (!snapshot.healthy_nodes) {
    return { label: 'All servers offline', detail: 'New requests cannot run until a server recovers.', color: '#ef4444', Icon: ShieldAlert, state: 'OFFLINE' };
  }
  if (!snapshot.active_tasks && !snapshot.queued_tasks && !snapshot.completed_tasks) {
    return { label: 'Waiting for traffic', detail: 'No requests have completed yet.', color: '#64748b', Icon: Clock3, state: 'IDLE' };
  }

  const latency = snapshot.avg_latency_ms || 0;
  const target = slaTarget || 250;

  // Red (SLA Breached): avg latency > target
  if (snapshot.completed_tasks > 0 && latency > target) {
    return {
      label: 'SLA Breached',
      detail: `Average latency (${latency.toFixed(1)}ms) exceeds the ${target}ms SLA threshold.`,
      color: '#ef4444',
      Icon: ShieldAlert,
      state: 'BREACHED'
    };
  }

  // Amber (SLA at Risk): approaching target (> 80% of target) or elevated backlog
  if ((snapshot.completed_tasks > 0 && latency > 0.8 * target) || snapshot.queued_tasks > 5) {
    return {
      label: 'SLA at Risk',
      detail: latency > 0.8 * target
        ? `Latency (${latency.toFixed(1)}ms) approaching the ${target}ms SLA limit.`
        : `${snapshot.queued_tasks} requests queued; latency degradation imminent.`,
      color: '#f59e0b',
      Icon: Clock3,
      state: 'AT_RISK'
    };
  }

  if (snapshot.queued_tasks > 0) {
    return {
      label: 'Requests Queued',
      detail: `${snapshot.queued_tasks} request${snapshot.queued_tasks === 1 ? '' : 's'} waiting for an available node.`,
      color: '#f59e0b',
      Icon: Clock3,
      state: 'QUEUED'
    };
  }

  // Green (SLA Healthy): within target and normal operations
  return {
    label: 'SLA Healthy',
    detail: snapshot.completed_tasks > 0
      ? `Operating within SLA targets (${latency.toFixed(1)}ms ≤ ${target}ms).`
      : 'Cluster available and ready for traffic.',
    color: '#10b981',
    Icon: CheckCircle2,
    state: 'HEALTHY'
  };
};

const decisionFromTrace = (trace, nodes) => {
  const nodeMatch = trace.match(/->\s*(node-\d+)/i) || trace.match(/Selected\s+(node-\d+)/i);
  const selectedName = nodeMatch?.[1]?.toLowerCase();
  const selectedNode = nodes.find(node => (node.name || `node-${node.id}`).toLowerCase() === selectedName)
    || (selectedName ? { name: selectedName } : null);
  const taskMatch = trace.match(/Request\s+#(\d+)/i) || trace.match(/Task\s+#(\d+)/i);
  const timeMatch = trace.match(/\[T=([\d.]+)s\]/);
  const candidatesFromTrace = [...trace.matchAll(/(node-\d+):\s*([\d.]+)%/gi)].map(([, name, load]) => ({ name, load: Number(load) }));
  // When candidates are not present in trace (e.g. Round Robin, Priority, First Fit), fall back to live cluster node loads
  const candidates = candidatesFromTrace.length > 0
    ? candidatesFromTrace
    : (nodes || []).map(n => ({
        name: n.name || `node-${n.id}`,
        load: n.cpu_util !== undefined ? n.cpu_util : (n.cpu_capacity ? (n.cpu_used / n.cpu_capacity) * 100 : 0)
      }));
  const selectedLoad = candidates.find(candidate => candidate.name.toLowerCase() === selectedName)?.load;
  return { selectedNode, taskId: taskMatch?.[1], candidates, selectedLoad, decisionTime: timeMatch?.[1] };
};

export default function RequestFlowExplainer({ snapshot, nodes = [], trace = '', slaTarget, policyName }) {
  const outcome = outcomeFor(snapshot, slaTarget);
  const { selectedNode, taskId, candidates, selectedLoad, decisionTime } = decisionFromTrace(trace, nodes);
  const nodeLabel = selectedNode?.name || 'No request selected yet';
  const lbReason = trace.includes(' | LB ') ? trace.split(' | ')[1] : '';
  const routingReason = lbReason || (selectedNode ? trace.replace(/^.*?\] ALLOC:.*?\[Finishes at T=[^\]]+\]\.\s*/, '') : 'Start playback to see the next routing decision.');
  const OutcomeIcon = outcome.Icon;

  return (
    <section className="card" aria-label="How requests move through the cloud cluster" style={{ padding: '16px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '13px' }}><Workflow size={16} color="#60a5fa" /> Request dispatch & SLA status</div>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px' }}>Live routing and pipeline response evaluation</div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: outcome.color,
          fontSize: '11px',
          fontWeight: 700,
          backgroundColor: `${outcome.color}15`,
          border: `1px solid ${outcome.color}40`,
          padding: '4px 10px',
          borderRadius: '4px'
        }}>
          <OutcomeIcon size={14} /> {outcome.label.toUpperCase()}
        </div>
      </div>

      <div className="request-flow" aria-live="polite">
        <div className="flow-step flow-incoming"><span className="flow-icon">↓</span><strong>{taskId ? `Request #${taskId}` : 'Incoming traffic'}</strong><small>{snapshot.throughput.toFixed(1)} req/s throughput</small></div>
        <ArrowRight className="flow-arrow" aria-hidden="true" />
        <div className="flow-step flow-router"><span className="flow-icon">↔</span><strong>{policyName || 'Dispatcher'}</strong><small>Active routing policy</small></div>
        <ArrowRight className="flow-arrow" aria-hidden="true" />
        <div className="flow-step flow-server flow-selected"><Target size={18} color="#60a5fa" aria-hidden="true" /><strong>{nodeLabel}</strong><small>Selected node · {selectedNode?.active_tasks || 0} active</small></div>
        <ArrowRight className="flow-arrow" aria-hidden="true" />
        <div className="flow-step" style={{ borderColor: outcome.color }}><OutcomeIcon size={18} color={outcome.color} aria-hidden="true" /><strong>{outcome.label}</strong><small>{outcome.detail}</small></div>
      </div>

      <div className="flow-reason" style={{ marginTop: '14px', borderLeft: `3px solid #60a5fa`, padding: '8px 12px', backgroundColor: 'rgba(15, 23, 42, 0.55)', fontSize: '11px', color: 'var(--text-secondary)' }}>
        <strong style={{ color: 'var(--text-primary)' }}>Dispatch decision: </strong>{routingReason}
      </div>

      {candidates.length > 0 && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Node load at dispatch{decisionTime ? ` · T=${decisionTime}s` : ''}</div>
          <div className="candidate-loads">
            {candidates.map(candidate => {
              const isSelected = candidate.name.toLowerCase() === nodeLabel.toLowerCase();
              return <div className={`candidate-load ${isSelected ? 'candidate-selected' : ''}`} key={candidate.name}>
                <div><span>{candidate.name}</span><strong>{candidate.load.toFixed(0)}%</strong></div>
                <div className="progress-bar-container"><div className="progress-bar-fill" style={{ width: `${Math.min(candidate.load, 100)}%`, backgroundColor: isSelected ? '#60a5fa' : candidate.load > 80 ? '#f59e0b' : '#64748b' }} /></div>
              </div>;
            })}
          </div>
        </div>
      )}
    </section>
  );
}

