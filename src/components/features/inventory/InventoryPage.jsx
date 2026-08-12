import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import RequireShift from '../../../components/features/shift/RequireShift.jsx';
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

// Maps internal tab keys to the URL segment shown in the address bar,
// e.g. /inventory/DailyCount — and back again for reading the URL on load.
const TAB_SEGMENTS = { dashboard: 'Dashboard', daily: 'DailyCount', delivery: 'Delivery', variance: 'Variance', history: 'History', meter: 'MeterReading' };
const SEGMENT_TO_TAB = Object.fromEntries(Object.entries(TAB_SEGMENTS).map(([k, v]) => [v.toLowerCase(), k]));

function segmentFromPath(pathname) {
  const seg = pathname.replace(/^\/inventory\/?/, '').split('/')[0] || '';
  return SEGMENT_TO_TAB[seg.toLowerCase()] || null;
}

function InventoryPageContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const [tab, setTabState] = useState(() => segmentFromPath(location.pathname) || location.state?.tab || 'dashboard');

  function setTab(newTab) {
    setTabState(newTab);
    navigate(`/inventory/${TAB_SEGMENTS[newTab]}`);
  }

  // Keep the active tab in sync with the URL for back/forward navigation
  // and direct links (e.g. from the End Shift modal).
  useEffect(() => {
    const matched = segmentFromPath(location.pathname);
    if (matched && matched !== tab) {
      setTabState(matched);
    } else if (!matched && location.pathname.replace(/\/$/, '') === '/inventory') {
      // Landed on the bare /inventory URL — normalize to the current tab's URL.
      navigate(`/inventory/${TAB_SEGMENTS[tab]}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

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

export default function InventoryPage() {
  return (
    <RequireShift>
      <InventoryPageContent />
    </RequireShift>
  );
}