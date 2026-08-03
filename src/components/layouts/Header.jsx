import { useEffect, useState } from 'react';

// Pages that show the live clock in the header (mirrors the legacy app's
// "operational" pages — shifts/deliveries happen here).
const CLOCK_PAGES = ['inventory', 'cash-drawer', 'pautang', 'customers', 'payroll', 'pos', 'logbook'];

function useClock(enabled) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [enabled]);
  return now;
}

export default function Header({ navItem, onMenuClick }) {
  const showClock = navItem && CLOCK_PAGES.includes(navItem.key);
  const now = useClock(showClock);

  // Dashboard hides the header entirely, matching the legacy app.
  if (navItem?.key === 'dashboard') return null;

  return (
    <header className="app-header" id="appHeader">
      <div className="header-left">
        <button id="menuToggle" onClick={onMenuClick} className="icon-btn mobile-menu-btn" type="button">
          <span className="material-icons-outlined" style={{ fontSize: 20 }}>menu</span>
        </button>
        <h1 className="page-title" id="pageTitle">{navItem?.label || 'Page'}</h1>
        {(navItem?.key === 'reports' || navItem?.key === 'pos') && (
          <button id="_infoBtn" className="info-btn" title="Help & tips for this page" type="button">?</button>
        )}
      </div>

      <div className="header-center" id="headerClock">
        {showClock && (
          <div className="header-clock-wrap">
            <span className="material-icons-outlined header-clock-icon">schedule</span>
            <span className="header-clock-time" id="headerClockTime">
              {now.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <span className="header-clock-date" id="headerClockDate">
              {now.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
        )}
      </div>

      <div className="header-right" id="headerRight">
        {navItem?.key === 'pos' && (
          <button type="button" className="btn-end-shift" id="endShiftBtn">
            <span className="material-icons-outlined">logout</span>
            End Shift
          </button>
        )}
      </div>
    </header>
  );
}