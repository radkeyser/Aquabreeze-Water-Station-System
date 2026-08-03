import { useEffect, useState } from 'react';
import { getCashManagementData } from '../../../api/cashManagement.js';
import { formatPeso } from '../../../utils/format.js';
import TransactionTable from './TransactionTable.jsx';

function SummaryCard({ icon, cls, label, val, sub }) {
  return (
    <div className="cash-summary-card">
      <div className={`cash-summary-icon ${cls}`}><span className="material-icons-outlined">{icon}</span></div>
      <div>
        <div className="cash-summary-label">{label}</div>
        <div className="cash-summary-val">{val}</div>
        {sub && <div className="cash-summary-sub">{sub}</div>}
      </div>
    </div>
  );
}

export default function DashboardTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getCashManagementData().then(setData).finally(() => setLoading(false)); }, []);

  if (loading) return <div style={{ padding: '80px 0', textAlign: 'center' }}><div className="spinner" /></div>;
  if (!data) return <div className="empty-state" style={{ padding: 48 }}>Error loading dashboard.</div>;

  const s = data.summary || {};
  const banks = data.accounts.filter((a) => a.type === 'Bank');
  const txs = data.transactions.slice(0, 10);

  return (
    <div>
      <div className="cash-summary-grid">
        <SummaryCard icon="account_balance_wallet" cls="green" label="Cash on Hand" val={formatPeso(s.cashOnHand || 0)} sub="Verified balance only" />
        <SummaryCard icon="account_balance" cls="teal" label="Cash in Bank" val={formatPeso(s.cashInBank || 0)} sub={`${banks.length} account${banks.length !== 1 ? 's' : ''}`} />
        <SummaryCard icon="savings" cls="amber" label="Petty Cash" val={formatPeso(s.pettyCash || 0)} />
        <SummaryCard icon="pending" cls="red" label="Unverified Cash" val={formatPeso(s.unverifiedCash || 0)} sub="From POS — not yet verified" />
      </div>

      {banks.length > 0 && (
        <>
          <div className="cash-section-hdr"><div className="cash-section-title"><span className="material-icons-outlined">account_balance</span> Bank Accounts</div></div>
          <div className="cash-bank-cards">
            {banks.map((b) => (
              <div className="cash-bank-card" key={b.id}>
                <div className="cash-bank-card-head">
                  <div className="cash-bank-name">{b.name}</div>
                  {b.accountNumber && <div className="cash-bank-num">Acct: ****{b.accountNumber}</div>}
                  <div className="cash-bank-bal">{formatPeso(b.balance)}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="cash-section-hdr"><div className="cash-section-title"><span className="material-icons-outlined">receipt_long</span> Recent Transactions</div></div>
      <TransactionTable transactions={txs} showFilters={false} />
    </div>
  );
}