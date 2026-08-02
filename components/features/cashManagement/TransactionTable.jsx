import { useEffect, useMemo, useState } from 'react';
import { formatPeso } from '../../../src/utils/format.js';

const TX_TYPES = ['Transfer', 'Deposit', 'Withdraw', 'Payment', 'Sales', 'Add', 'Cash Out'];

export default function TransactionTable({ transactions, showFilters, accountOptions }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const isAccountMode = accountOptions && accountOptions.length > 1;

  function getDateRange(tf) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    if (tf === 'today') return { from: today, to: today };
    if (tf === 'week') { const w = new Date(now); w.setDate(now.getDate() - 6); return { from: w.toISOString().split('T')[0], to: today }; }
    if (tf === 'month') { const m = new Date(now.getFullYear(), now.getMonth(), 1); return { from: m.toISOString().split('T')[0], to: today }; }
    return null;
  }

  const filtered = useMemo(() => {
    let from = '', to = '';
    if (dateFilter === 'custom') { from = customFrom; to = customTo; }
    else if (dateFilter !== 'all') { const r = getDateRange(dateFilter); if (r) { from = r.from; to = r.to; } }
    const q = search.toLowerCase();
    return transactions.filter((t) => {
      const text = Object.values(t).join(' ').toLowerCase();
      const matchQ = !q || text.includes(q);
      let matchType = true;
      if (typeFilter) {
        matchType = isAccountMode
          ? (t.from || '').toLowerCase() === typeFilter || (t.to || '').toLowerCase() === typeFilter
          : t.type.toLowerCase() === typeFilter;
      }
      const matchDate = (!from || t.date >= from) && (!to || t.date <= to);
      return matchQ && matchType && matchDate;
    });
  }, [transactions, search, typeFilter, dateFilter, customFrom, customTo, isAccountMode]);

  useEffect(() => { setPage(1); }, [search, typeFilter, dateFilter, customFrom, customTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageData = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <>
      {showFilters && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
          <input type="text" className="search-input" placeholder="Search..." style={{ flex: 1, minWidth: 160 }} value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="filter-person-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">{isAccountMode ? 'All Accounts' : 'All Types'}</option>
            {(isAccountMode ? accountOptions : TX_TYPES).map((o) => <option key={o} value={o.toLowerCase()}>{o}</option>)}
          </select>
          <select className="filter-person-select" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
            <option value="all">All Time</option><option value="today">Today</option><option value="week">This Week</option>
            <option value="month">This Month</option><option value="custom">Custom Range</option>
          </select>
          {dateFilter === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input type="date" className="pdp-input" style={{ width: 140, fontSize: 13 }} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <span style={{ fontSize: 13, color: 'var(--muted-fg)' }}>to</span>
              <input type="date" className="pdp-input" style={{ width: 140, fontSize: 13 }} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          )}
        </div>
      )}
      <div className="card"><div className="card-body" style={{ overflowX: 'auto', padding: '12px 20px' }}>
        <table className="data-table" style={{ minWidth: 1000, tableLayout: 'fixed', width: '100%' }}>
          <thead><tr>
            <th style={{ width: 130, textAlign: 'left' }}>Date</th>
            <th style={{ width: 90, textAlign: 'center' }}>Type</th>
            <th style={{ width: 80, textAlign: 'center' }}>From</th>
            <th style={{ width: 80, textAlign: 'center' }}>To</th>
            <th style={{ width: 130, textAlign: 'right' }}>Amount</th>
            <th style={{ width: 140, textAlign: 'center' }}>Reference</th>
            <th style={{ width: 250, textAlign: 'left' }}>Description</th>
            <th style={{ width: 100, textAlign: 'center' }}>Status</th>
          </tr></thead>
          <tbody>
            {pageData.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--muted-fg)' }}>No transactions yet.</td></tr>
            ) : pageData.map((t) => (
              <tr key={t.id}>
                <td style={{ whiteSpace: 'nowrap' }}><div style={{ fontSize: 13, fontWeight: 600 }}>{t.date}</div><div className="inv-time">{t.time}</div></td>
                <td style={{ textAlign: 'center' }}><span className={`cash-tx-type-badge cash-tx-${t.type.toLowerCase().replace(/\s+/g, '-')}`}>{t.type}</span></td>
                <td style={{ textAlign: 'center', color: 'var(--muted-fg)', fontSize: 13 }}>{t.from || '--'}</td>
                <td style={{ textAlign: 'center', color: 'var(--muted-fg)', fontSize: 13 }}>{t.to || '--'}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatPeso(t.amount)}</td>
                <td style={{ textAlign: 'center', fontSize: 12, color: 'var(--muted-fg)' }}>{t.reference || '--'}</td>
                <td style={{ fontSize: 12, color: 'var(--muted-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description || '--'}</td>
                <td style={{ textAlign: 'center' }}>{t.status === 'Unverified' ? <span className="cash-tx-type-badge cash-tx-unverified">Unverified</span> : <span style={{ color: 'hsl(150,45%,38%)', fontSize: 12, fontWeight: 700 }}>✓ Verified</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
      {filtered.length > pageSize && (
        <div className="paginator">
          <button type="button" className="paginator-btn" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
          <span className="paginator-info">Page {page} of {totalPages}</span>
          <button type="button" className="paginator-btn" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
        </div>
      )}
    </>
  );
}