import React, { useState, useEffect } from 'react';
import TopNav from './components/TopNav';
import Dashboard from './pages/Dashboard';
import WorkloadStudio from './pages/WorkloadStudio';
import SimulationConsole from './pages/SimulationConsole';
import ResultsAnalytics from './pages/ResultsAnalytics';
import ComparisonStudio from './pages/ComparisonStudio';

import {
  fetchSimulations,
  fetchSimulation,
  createSimulation,
  fetchPresets,
  compareSimulations,
  deleteSimulation
} from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [simulations, setSimulations] = useState([]);
  const [presets, setPresets] = useState([]);
  const [activeSimulation, setActiveSimulation] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      const [presetsList, simsList] = await Promise.all([
        fetchPresets().catch(() => []),
        fetchSimulations().catch(() => [])
      ]);
      setPresets(presetsList);
      setSimulations(simsList);

      // If simulations exist, set active simulation to the most recent one
      if (simsList.length > 0) {
        const latest = await fetchSimulation(simsList[0].id).catch(() => null);
        if (latest) {
          setActiveSimulation(latest);
        }
      }
    } catch (err) {
      console.error('Initial data loading error:', err);
    }
  }

  const handleRunSimulation = async (config) => {
    setIsRunning(true);
    setErrorMessage(null);
    try {
      const runResult = await createSimulation(config);
      // Fetch full record
      const fullRecord = await fetchSimulation(runResult.id);
      setActiveSimulation(fullRecord);

      // Refresh list
      const updatedList = await fetchSimulations();
      setSimulations(updatedList);

      // Switch to simulation console view
      setActiveTab('console');
    } catch (err) {
      setErrorMessage(err.message || 'Simulation execution failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleLaunchPreset = async (preset) => {
    handleRunSimulation(preset.config);
  };

  const handleSelectSimulation = async (id) => {
    try {
      const sim = await fetchSimulation(id);
      setActiveSimulation(sim);
      setActiveTab('results');
    } catch (err) {
      setErrorMessage(`Failed to load simulation: ${err.message}`);
    }
  };

  const handleDeleteSimulation = async (id) => {
    try {
      await deleteSimulation(id);
      const updated = await fetchSimulations();
      setSimulations(updated);
      if (activeSimulation && activeSimulation.id === id) {
        setActiveSimulation(null);
      }
    } catch (err) {
      setErrorMessage(`Failed to delete simulation: ${err.message}`);
    }
  };

  const handleCompareSimulations = async (simIds) => {
    try {
      const data = await compareSimulations(simIds);
      setComparisonData(data);
      setActiveTab('comparison');
    } catch (err) {
      setErrorMessage(`Comparison failed: ${err.message}`);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      {/* Top Navigation */}
      <TopNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        activeSimulationCount={simulations.length}
      />

      {/* Main Container */}
      <main style={{ flex: 1, maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '24px' }}>
        
        {/* Global Error Banner */}
        {errorMessage && (
          <div style={{
            marginBottom: '20px',
            padding: '12px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: '#f87171',
            fontSize: '13px'
          }}>
            <span>{errorMessage}</span>
            <button
              onClick={() => setErrorMessage(null)}
              style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontWeight: 700 }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Dynamic Pages */}
        {activeTab === 'dashboard' && (
          <Dashboard
            simulations={simulations}
            presets={presets}
            onSelectSimulation={handleSelectSimulation}
            onLaunchPreset={handleLaunchPreset}
            onNavigate={setActiveTab}
            onDeleteSimulation={handleDeleteSimulation}
            onCompareSimulations={handleCompareSimulations}
          />
        )}

        {activeTab === 'studio' && (
          <WorkloadStudio
            presets={presets}
            onRunSimulation={handleRunSimulation}
            isRunning={isRunning}
          />
        )}

        {activeTab === 'console' && (
          <SimulationConsole
            simulation={activeSimulation}
            onNavigateToResults={() => setActiveTab('results')}
          />
        )}

        {activeTab === 'results' && (
          <ResultsAnalytics
            simulation={activeSimulation}
            onBackToConsole={() => setActiveTab('console')}
          />
        )}

        {activeTab === 'comparison' && (
          <ComparisonStudio
            comparisonData={comparisonData}
            simulations={simulations}
            onCompareSimulations={handleCompareSimulations}
          />
        )}
      </main>
    </div>
  );
}
