import { useState } from 'react';
import DashboardTab from './DashboardTab.jsx';
import CashTab from './CashTab.jsx';
import BankTab from './BankTab.jsx';
import PettyTab from './PettyTab.jsx';
import VerificationTab from './VerificationTab.jsx';
import ReconciliationTab from './ReconciliationTab.jsx';
import HistoryTab from './HistoryTab.jsx';
import './cashmanagement.css';

const TABS = [
  { key: 'dashboard', icon: 'dashboard', label: 'Dashboard' },
  { key: 'cash', icon: 'account_balance_wallet', label: 'Cash' },
  { key: 'bank', icon: 'account_balance', label: 'Bank' },
  { key: 'petty', icon: 'savings', label: 'Petty Cash' },
  { key: 'verification', icon: 'verified', label: 'Shift Verification' },
  { key: 'reconciliation', icon: 'balance', label: 'Bank Reconciliation' },
  { key: 'history', icon: 'history', label: 'Transaction History' },
];

export default function CashManagementPage() {
  const [tab, setTab] = useState('dashboard');

  return (
    <div className="inv-wrapper">
      <div className="inv-tab-bar" style={{ display: 'flex' }}>
        {TABS.map((t) => (
          <button key={t.key} type="button" className={`inv-tab${tab === t.key ? ' active' : ''}`} onClick={() => setTab(t.key)}>
            <span className="material-icons-outlined">{t.icon}</span>
            <span className="inv-tab-label">{t.label}</span>
          </button>
        ))}
      </div>
      <div id="cashTabContent" className="cash-tab-content">
        {tab === 'dashboard' && <DashboardTab />}
        {tab === 'cash' && <CashTab />}
        {tab === 'bank' && <BankTab />}
        {tab === 'petty' && <PettyTab />}
        {tab === 'verification' && <VerificationTab />}
        {tab === 'reconciliation' && <ReconciliationTab />}
        {tab === 'history' && <HistoryTab />}
      </div>
    </div>
  );
}