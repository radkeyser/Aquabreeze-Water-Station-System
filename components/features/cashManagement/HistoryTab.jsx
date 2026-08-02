import { useEffect, useState } from 'react';
import { getCashManagementData } from '../../../src/api/cashManagement.js';
import TransactionTable from './TransactionTable.jsx';

export default function HistoryTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { getCashManagementData().then(setData).finally(() => setLoading(false)); }, []);

  if (loading) return <div style={{ padding: '80px 0', textAlign: 'center' }}><div className="spinner" /></div>;
  if (!data) return <div className="empty-state" style={{ padding: 48 }}>Error loading data.</div>;

  return (
    <div>
      <div className="cash-section-hdr">
        <div className="cash-section-title"><span className="material-icons-outlined">history</span> All Transactions</div>
        <div className="cash-section-sub">{data.transactions.length} total</div>
      </div>
      <TransactionTable transactions={data.transactions} showFilters />
    </div>
  );
}