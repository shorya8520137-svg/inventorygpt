// dashboard/src/App.jsx
import React, { useState, useEffect } from 'react';
import { Activity, Box, GitMerge, ShieldAlert, Cpu } from 'lucide-react';

function App() {
  const [truthData, setTruthData] = useState([]);
  const [feedData, setFeedData] = useState([]);
  const [trustData, setTrustData] = useState([]);
  const [timelineData, setTimelineData] = useState([]);

  // Fetch data from existing backend
  const fetchData = async () => {
    try {
      const [truthRes, feedRes, trustRes, timelineRes] = await Promise.all([
        fetch('http://localhost:3001/api/command-center/truth').then(r => r.json()),
        fetch('http://localhost:3001/api/command-center/feed').then(r => r.json()),
        fetch('http://localhost:3001/api/command-center/ai-trust').then(r => r.json()),
        fetch('http://localhost:3001/api/command-center/timeline').then(r => r.json())
      ]);

      if (truthRes.success) setTruthData(truthRes.data);
      if (feedRes.success) setFeedData(feedRes.data);
      if (trustRes.success) setTrustData(trustRes.data);
      if (timelineRes.success) setTimelineData(timelineRes.data);
    } catch (e) {
      console.error("Failed to fetch dashboard data", e);
    }
  };

  useEffect(() => {
    fetchData();
    // Poll every 5 seconds for real-time visibility
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div>
          <h1 className="dashboard-title">InventoryGPT Command Center</h1>
          <p className="dashboard-subtitle">Real-time Operational Visibility & Execution Observability</p>
        </div>
        <div className="live-indicator">
          <div className="pulse"></div>
          SYSTEM LIVE
        </div>
      </header>

      <div className="dashboard-grid">
        
        {/* Module 1: Inventory Truth Dashboard */}
        <div className="panel col-span-8">
          <h2 className="panel-title">
            <Box size={20} /> Inventory Truth Engine (Logical vs Physical)
          </h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Location</th>
                <th>SKU</th>
                <th>Physical</th>
                <th>Planned</th>
                <th>Sellable</th>
              </tr>
            </thead>
            <tbody>
              {truthData.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.location_id}</td>
                  <td>{item.sku}</td>
                  <td><strong>{item.physical_stock}</strong></td>
                  <td style={{ color: 'var(--accent-orange)' }}>{item.planned_stock}</td>
                  <td style={{ color: 'var(--accent-green)' }}>{item.sellable_stock}</td>
                </tr>
              ))}
              {truthData.length === 0 && <tr><td colSpan="5">Loading...</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Module 7: AI Trust & Accuracy */}
        <div className="panel col-span-4">
          <h2 className="panel-title">
            <Cpu size={20} /> AI Accuracy & Trust
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {trustData.map((agent, idx) => (
              <div key={idx} style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>{agent.agent_name}</span>
                  <span style={{ color: 'var(--accent-green)', fontWeight: '700' }}>{agent.accuracy_score}%</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: `${agent.accuracy_score}%`, height: '100%', background: 'var(--accent-green)' }}></div>
                </div>
              </div>
            ))}
            {trustData.length === 0 && <p>Loading...</p>}
          </div>
        </div>

        {/* Module 2: Transfer Lifecycle Timeline */}
        <div className="panel col-span-8">
          <h2 className="panel-title">
            <GitMerge size={20} /> Transfer Execution Lifecycle
          </h2>
          <table className="data-table">
            <thead>
              <tr>
                <th>Task ID</th>
                <th>Route</th>
                <th>SKU (Qty)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {timelineData.map((task, idx) => (
                <tr key={idx}>
                  <td style={{ fontFamily: 'monospace', color: 'var(--accent-blue)' }}>{task.task_id}</td>
                  <td>{task.source_location} → {task.target_location}</td>
                  <td>{task.sku} ({task.quantity})</td>
                  <td>
                    <span className={`badge ${task.lifecycle_state === 'COMPLETED' ? 'badge-green' : task.lifecycle_state === 'FAILED' ? 'badge-red' : 'badge-yellow'}`}>
                      {task.lifecycle_state}
                    </span>
                  </td>
                </tr>
              ))}
              {timelineData.length === 0 && <tr><td colSpan="4">Loading...</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Module 10: Event Feed */}
        <div className="panel col-span-4">
          <h2 className="panel-title">
            <ShieldAlert size={20} /> Live Operational Feed
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {feedData.map((event, idx) => (
              <div className="feed-item" key={idx}>
                <div className={`feed-icon ${event.severity.toLowerCase()}`}>
                  <ShieldAlert size={18} />
                </div>
                <div className="feed-content">
                  <p>{event.message}</p>
                  <span className="feed-time">{new Date(event.created_at).toLocaleTimeString()} • {event.event_type}</span>
                </div>
              </div>
            ))}
            {feedData.length === 0 && <p>Loading...</p>}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
