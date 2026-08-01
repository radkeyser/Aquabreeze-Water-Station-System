import { useState } from 'react';
import DashboardTab from './DashboardTab.jsx';
import DailyCountTab from './DailyCountTab.jsx';
import DeliveryTab from './DeliveryTab.jsx';
import VarianceTab from './VarianceTab.jsx';
import HistoryTab from './HistoryTab.jsx';
import MeterReadingTab from './MeterReadingTab.jsx';
import './inventory.css';

const TABS = [
  { key: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
  { key: 'daily', icon: 'fact_check', label: 'Daily Count' },
  { key: 'delivery', icon: 'local_shipping', label: 'Delivery' },
  { key: 'variance', icon: 'analytics', label: 'Variance' },
  { key: 'history', icon: 'calendar_month', label: 'History' },
  { key: 'meter', icon: 'speed', label: 'Meter Reading' },
];

export default function InventoryPage() {
  const [tab, setTab] = useState('dashboard');

  return (
    <div className="inv-wrapper">
      <div className="inv-tab-bar" style={{ display: 'flex' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`inv-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <span className="material-icons-outlined">{t.icon}</span>
            <span className="inv-tab-label">{t.label}</span>
          </button>
        ))}
      </div>
      <div id="invTabContent">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'daily' && <DailyCountTab />}
        {tab === 'delivery' && <DeliveryTab />}
        {tab === 'variance' && <VarianceTab />}
        {tab === 'history' && <HistoryTab />}
        {tab === 'meter' && <MeterReadingTab onGoToDaily={() => setTab('daily')} />}
      </div>
    </div>
  );
}