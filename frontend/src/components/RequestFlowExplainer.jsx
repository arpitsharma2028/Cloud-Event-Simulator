import React from 'react';
import { ArrowRight, CheckCircle2, Clock3, Server, ShieldAlert, Workflow, Target } from 'lucide-react';

const outcomeFor = (snapshot, slaTarget) => {
  if (snapshot.avg_latency_ms > slaTarget) return { label: 'SLA at risk', detail: 'Requests are taking longer than the target.', color: '#ef4444', Icon: ShieldAlert };
  if (snapshot.queued_tasks > 0) return { label: 'Some requests are waiting', detail: `${snapshot.queued_tasks} request${snapshot.queued_tasks === 1 ? '' : 's'} is waiting for a server.`, color: '#f59e0b', Icon: Clock3 };
  return { label: 'Requests are flowing normally', detail: 'Available servers are handling incoming work.', color: '#10b981', Icon: CheckCircle2 };
};

const decisionFromTrace = (trace, nodes) => {
  const nodeMatch = trace.match(/->\s*(node-\d+)/i) || trace.match(/Selected\s+(node-\d+)/i);
  const selectedName = nodeMatch?.[1]?.toLowerCase();
  const selectedNode = nodes.find(node => (node.name || `node-${node.id}`).toLowerCase() === selectedName)
    || nodes.find(node => node.status === 'BUSY' || node.status === 'HEALTHY')
    || nodes[0];
  const taskMatch = trace.match(/Request\s+#(\d+)/i) || trace.match(/Task\s+#(\d+)/i);
  const timeMatch = trace.match(/\[T=([\d.]+)s\]/);
  const candidates = [...trace.matchAll(/(node-\d+):\s*([\d.]+)%/gi)].map(([, name, load]) => ({ name, load: Number(load) }));
  const selectedLoad = candidates.find(candidate => candidate.name.toLowerCase() === selectedName)?.load;
  return { selectedNode, taskId: taskMatch?.[1], candidates, selectedLoad, decisionTime: timeMatch?.[1] };
};

export default function RequestFlowExplainer({ snapshot, nodes = [], trace = '', slaTarget }) {
  const outcome = outcomeFor(snapshot, slaTarget);
  const { selectedNode, taskId, candidates, selectedLoad, decisionTime } = decisionFromTrace(trace, nodes);
  const nodeLabel = selectedNode?.name || 'an available server';
  const routingReason = selectedLoad !== undefined
    ? `${nodeLabel} had the lowest observed load (${selectedLoad.toFixed(1)}%).`
    : `${nodeLabel} was selected by the active scheduling policy.`;
  const OutcomeIcon = outcome.Icon;

  return (
    <section className="card" aria-label="How requests move through the cloud cluster" style={{ padding: '18px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}><Workflow size={17} color="#60a5fa" /> What is happening right now</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Follow one request from arrival to its current outcome.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: outcome.color, fontSize: '12px', fontWeight: 600 }}><OutcomeIcon size={16} /> {outcome.label}</div>
      </div>

      <div className="request-flow" aria-live="polite">
          <div className="flow-step flow-incoming"><span className="flow-icon">↓</span><strong>{taskId ? `Request #${taskId}` : 'Incoming traffic'}</strong><small>About {snapshot.throughput.toFixed(1)} requests handled each second</small></div>
        <ArrowRight className="flow-arrow" aria-hidden="true" />
        <div className="flow-step flow-router"><span className="flow-icon">↔</span><strong>Traffic router</strong><small>Chooses where each request goes</small></div>
        <ArrowRight className="flow-arrow" aria-hidden="true" />
        <div className="flow-step flow-server flow-selected"><Target size={20} color="#60a5fa" aria-hidden="true" /><strong>{nodeLabel}</strong><small>Selected for this request · {selectedNode?.active_tasks || 0} task{(selectedNode?.active_tasks || 0) === 1 ? '' : 's'} running</small></div>
        <ArrowRight className="flow-arrow" aria-hidden="true" />
        <div className="flow-step" style={{ borderColor: outcome.color }}><OutcomeIcon size={20} color={outcome.color} aria-hidden="true" /><strong>{outcome.label}</strong><small>{outcome.detail}</small></div>
      </div>

      <div className="flow-reason" style={{ marginTop: '16px', borderLeft: `3px solid #60a5fa`, padding: '9px 12px', backgroundColor: 'rgba(15, 23, 42, 0.55)', fontSize: '12px', color: 'var(--text-secondary)' }}>
        <strong style={{ color: 'var(--text-primary)' }}>Why this server? </strong>{routingReason}
      </div>

      {candidates.length > 0 && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Server load when this request was routed{decisionTime ? ` · T=${decisionTime}s` : ''}</div>
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
