const API_BASE = '/api';

export async function fetchSimulations() {
  const res = await fetch(`${API_BASE}/simulations`);
  if (!res.ok) throw new Error('Failed to fetch simulations');
  const data = await res.json();
  return data.simulations || [];
}

export async function fetchSimulation(id) {
  const res = await fetch(`${API_BASE}/simulations/${id}`);
  if (!res.ok) throw new Error(`Failed to fetch simulation ${id}`);
  return await res.json();
}

export async function createSimulation(config) {
  const res = await fetch(`${API_BASE}/simulations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message = errorData.details
      ? errorData.details.map(d => `${d.field}: ${d.message}`).join(', ')
      : errorData.error || 'Failed to create simulation';
    throw new Error(message);
  }
  return await res.json();
}

export async function fetchPresets() {
  const res = await fetch(`${API_BASE}/presets`);
  if (!res.ok) throw new Error('Failed to fetch presets');
  const data = await res.json();
  return data.presets || [];
}

export async function compareSimulations(simulationIds) {
  const res = await fetch(`${API_BASE}/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ simulationIds })
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to compare simulations');
  }
  return await res.json();
}

export async function runPolicyExperiment(experimentPayload) {
  const res = await fetch(`${API_BASE}/compare/experiment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(experimentPayload)
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to execute policy experiment');
  }
  return await res.json();
}

export async function deleteSimulation(id) {
  const res = await fetch(`${API_BASE}/simulations/${id}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete simulation');
  return await res.json();
}

export function subscribeToSimulationStream(id, onStep, onComplete, onError) {
  const eventSource = new EventSource(`${API_BASE}/simulations/${id}/stream`);

  eventSource.addEventListener('step', (event) => {
    try {
      const data = JSON.parse(event.data);
      if (onStep) onStep(data);
    } catch (e) {
      console.error('Error parsing SSE step:', e);
    }
  });

  eventSource.addEventListener('complete', (event) => {
    try {
      const data = JSON.parse(event.data);
      if (onComplete) onComplete(data);
      eventSource.close();
    } catch (e) {
      console.error('Error parsing SSE complete:', e);
    }
  });

  eventSource.onerror = (err) => {
    if (onError) onError(err);
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
}
