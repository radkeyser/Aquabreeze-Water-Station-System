import { useEffect, useMemo, useState } from 'react';
import { getRemitData, getRemitHistory, getPointPersonList, remitOrderPayment } from '../../../api/remit.js';
import { formatPeso } from '../../../utils/format.js';
import { showToast } from '../../../utils/toast.js';
import './remit.css';

function todayISO() { return new Date().toISOString().slice(0, 10); }
function yesterdayISO() { const d = new Date(); d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); }

export default function RemitPage() {
  const [tab, setTab] = useState('remit');
  return (
    <div className="page-content remit-page">
      <div className="remit-tab-bar">
        <button type="button" className={`remit-tab${tab === 'remit' ? ' active' : ''}`} onClick={() => setTab('remit')}>
          <span className="material-icons-outlined">move_to_inbox</span> Remit
        </button>
        <button type="button" className={`remit-tab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>
          <span className="material-icons-outlined">history</span> History
        </button>
        <button type="button" className={`remit-tab${tab === 'byperson' ? ' active' : ''}`} onClick={() => setTab('byperson')}>
          <span className="material-icons-outlined">groups</span> By Point Person
        </button>
      </div>
      {tab === 'remit' && <RemitWorklist />}
      {tab === 'history' && <RemitHistoryTab />}
      {tab === 'byperson' && <RemitByPersonTab />}
    </div>
  );
}

// ─────────────────────────── Tab 1: Remit worklist ───────────────────────────
function RemitWorklist() {
  const [rows, setRows] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ppFilter, setPpFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [payTarget, setPayTarget] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [data, staff] = await Promise.all([getRemitData(), getPointPersonList()]);
      setRows(data);
      setStaffList(staff);
    } catch (err) {
      setError(err?.message || 'Failed to load remit data.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  function toggleSort(col) {
    if (sortCol === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('asc'); }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const today = todayISO();
    const yesterday = yesterdayISO();

    let list = rows.filter((r) => {
      const matchQ = !q || r.customerName.toLowerCase().includes(q) || r.orderId.toLowerCase().includes(q) || r.pointPerson.toLowerCase().includes(q);
      const matchStatus = !statusFilter || r.paymentStatus.toLowerCase() === statusFilter;
      const matchPP = !ppFilter || r.pointPerson.toLowerCase() === ppFilter.toLowerCase();
      const matchDate = dateFilter === 'all' || (dateFilter === 'today' ? r.deliveredDate === today : r.deliveredDate === yesterday);
      return matchQ && matchStatus && matchPP && matchDate;
    });

    if (sortCol) {
      list = [...list].sort((a, b) => {
        let va = a[sortCol];
        let vb = b[sortCol];
        if (sortCol === 'deliveredDate') { va = a.deliveredDate || ''; vb = b.deliveredDate || ''; }
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * (sortDir === 'asc' ? 1 : -1);
        return String(va || '').localeCompare(String(vb || '')) * (sortDir === 'asc' ? 1 : -1);
      });
    }
    return list;
  }, [rows, search, statusFilter, ppFilter, dateFilter, sortCol, sortDir]);

  const totalOutstanding = useMemo(() => filtered.reduce((s, r) => s + r.balance, 0), [filtered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageData = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize]
  );
  const rangeStart = filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, filtered.length);

  useEffect(() => { setPage(1); }, [search, statusFilter, ppFilter, dateFilter, sortCol, sortDir, pageSize]);

  function handlePageInput(e) {
    const val = parseInt(e.target.value, 10);
    if (!Number.isNaN(val) && val >= 1 && val <= totalPages) setPage(val);
  }

  const todaysSummary = useMemo(() => {
    const today = todayISO();
    const todayRows = rows.filter((r) => r.deliveredDate === today);
    const fullyRemitted = todayRows.filter((r) => r.paymentStatus === 'Paid').length;
    return { total: todayRows.length, fullyRemitted, outstanding: todayRows.length - fullyRemitted };
  }, [rows]);

  function openPay(row) {
    setPayTarget(row);
    setPayAmount(String(row.balance));
    setPayMethod('Cash');
  }
  function closePay() { setPayTarget(null); }

  async function confirmPay() {
    if (!payTarget) return;
    const amount = parseFloat(payAmount) || 0;
    if (amount <= 0 || amount > payTarget.balance) {
      showToast('Please enter a valid amount.', { type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const result = await remitOrderPayment(payTarget.orderId, amount, payMethod);
      if (result?.success === false) throw new Error(result.message);
      showToast(result?.message || 'Recorded!', { type: 'success' });
      closePay();
      await load();
    } catch (err) {
      showToast(err?.message || 'Failed to record payment.', { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  function SortHeader({ col, children }) {
    return (
      <th onClick={() => toggleSort(col)} style={{ cursor: 'pointer', userSelect: 'none' }}>
        {children} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
      </th>
    );
  }

  return (
    <div>
      {error && (
        <div className="shift-warning-banner" style={{ background: 'var(--destructive-light)', borderColor: 'var(--destructive)', color: 'var(--destructive)' }}>
          <span className="material-icons-outlined">error_outline</span>
          {error}
        </div>
      )}

      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-icon primary"><span className="material-icons-outlined">local_shipping</span></div>
          <div>
            <div className="summary-label">Delivered Today</div>
            <div className="summary-value">{todaysSummary.total}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon success"><span className="material-icons-outlined">check_circle</span></div>
          <div>
            <div className="summary-label">Fully Remitted Today</div>
            <div className="summary-value">{todaysSummary.fullyRemitted} / {todaysSummary.total}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon danger"><span className="material-icons-outlined">move_to_inbox</span></div>
          <div>
            <div className="summary-label">Outstanding ({dateFilter})</div>
            <div className="summary-value text-danger">{formatPeso(totalOutstanding)}</div>
          </div>
        </div>
      </div>

      <div className="remit-toolbar">
        <div className="remit-toolbar-row remit-toolbar-row-main">
          <div className="remit-search-wrap">
            <span className="material-icons-outlined remit-search-icon">search</span>
            <input
              type="text"
              className="search-input remit-search-input"
              placeholder="Search customer, order ID, point person..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="remit-search-clear" onClick={() => setSearch('')}>
                <span className="material-icons-outlined">close</span>
              </button>
            )}
          </div>
          <div className="remit-date-tabs">
            {['today', 'yesterday', 'all'].map((val) => (
              <button key={val} type="button" className={`filter-tab${dateFilter === val ? ' active' : ''}`} onClick={() => setDateFilter(val)}>
                {val === 'today' ? 'Today' : val === 'yesterday' ? 'Yesterday' : 'All'}
              </button>
            ))}
          </div>
        </div>
        <div className="remit-toolbar-row remit-toolbar-row-sub">
          <span className="remit-toolbar-label"><span className="material-icons-outlined">tune</span>Filters</span>
          <select className="filter-person-select remit-select" value={ppFilter} onChange={(e) => setPpFilter(e.target.value)}>
            <option value="">All Point Persons</option>
            {staffList.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <select className="filter-person-select remit-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="utang">Utang</option>
          </select>
          {(ppFilter || statusFilter) && (
            <button type="button" className="remit-clear-filters" onClick={() => { setPpFilter(''); setStatusFilter(''); }}>
              <span className="material-icons-outlined">filter_alt_off</span> Clear
            </button>
          )}
        </div>
      </div>

      <div className="card remit-card">
        <div className="card-body remit-table-wrap">
          <table className="data-table" style={{ minWidth: 1000 }}>
            <thead>
              <tr>
                <SortHeader col="orderId">Order ID</SortHeader>
                <SortHeader col="deliveredDate">Date Delivered</SortHeader>
                <SortHeader col="customerName">Customer</SortHeader>
                <SortHeader col="pointPerson">Point Person</SortHeader>
                <th>Product</th>
                <th>Qty</th>
                <th>Total</th>
                <SortHeader col="balance">Balance</SortHeader>
                <th>Delivery</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40 }}>Loading...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: 'center', padding: 40, color: 'var(--muted-fg)' }}>No delivered orders found.</td></tr>
              )}
              {!loading && pageData.map((r) => (
                <tr key={r.orderId}>
                  <td data-label="Order ID" style={{ fontSize: 12, color: 'var(--muted-fg)' }}>{r.orderId}</td>
                  <td data-label="Date Delivered"><div>{r.deliveredDateDisplay || '--'}</div><div style={{ fontSize: 11, color: 'var(--muted-fg)' }}>{r.deliveredTime}</div></td>
                  <td data-label="Customer" style={{ fontWeight: 700 }}>{r.customerName}{r.location ? ` — ${r.location}` : ''}</td>
                  <td data-label="Point Person">{r.pointPerson || '--'}</td>
                  <td data-label="Product">{r.product}{r.slimPoly ? ` (${r.slimPoly})` : ''}</td>
                  <td data-label="Qty">{r.qty}</td>
                  <td data-label="Total">{formatPeso(r.total)}</td>
                  <td data-label="Balance" style={{ fontWeight: 700 }}>{r.balance > 0 ? formatPeso(r.balance) : '--'}</td>
                  <td data-label="Delivery">
                    <span className={`badge ${r.deliveryStatus === 'Delivered' ? 'badge-success' : 'badge-warning'}`}>{r.deliveryStatus}</span>
                  </td>
                  <td data-label="Status">
                    <span className={`badge ${r.paymentStatus === 'Paid' ? 'badge-success' : r.paymentStatus === 'Partial' ? 'badge-warning' : 'badge-danger'}`}>{r.paymentStatus}</span>
                  </td>
                  <td data-label="Action">
                    {r.paymentStatus === 'Paid' ? (
                      <span style={{ color: 'var(--muted-fg)', fontSize: 12 }}>--</span>
                    ) : (
                      <button type="button" className="remit-btn" onClick={() => openPay(r)}>
                        <span className="material-icons-outlined">move_to_inbox</span> Remit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="remit-paginator">
            <span className="remit-paginator-info">Showing {rangeStart}–{rangeEnd} of {filtered.length} results</span>
            <div className="remit-paginator-controls">
              <select className="remit-page-size-select" value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <button type="button" className="remit-page-btn" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
                <span className="material-icons-outlined">chevron_left</span>
              </button>
              <input
                type="number"
                className="remit-page-input"
                value={currentPage}
                min={1}
                max={totalPages}
                onChange={handlePageInput}
              />
              <span className="remit-paginator-of">of {totalPages}</span>
              <button type="button" className="remit-page-btn" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <span className="material-icons-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`pay-modal-overlay${payTarget ? ' show' : ''}`}>
        <div className="pay-modal">
          <div className="pay-modal-header">
            <div className="pay-modal-title">Remit Payment</div>
            <button type="button" className="pdp-close-btn" onClick={closePay}><span className="material-icons-outlined">close</span></button>
          </div>
          {payTarget && (
            <div className="pay-modal-body">
              <div className="pay-modal-info">
                <div className="pay-modal-customer">{payTarget.customerName}</div>
                <div className="pay-modal-debt">Balance: <strong>{formatPeso(payTarget.balance)}</strong></div>
              </div>
              <div className="pdp-field">
                <label className="pdp-label">Amount</label>
                <div className="pdp-amount-row">
                  <input type="number" className="pdp-input" min={0} max={payTarget.balance} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                  <button type="button" className="btn-exact" onClick={() => setPayAmount(String(payTarget.balance))}>Exact</button>
                </div>
              </div>
              <div className="pdp-pay-method-row">
                <label className="pdp-pay-method-option">
                  <input type="radio" name="remitPayMethod" value="Cash" checked={payMethod === 'Cash'} onChange={() => setPayMethod('Cash')} />
                  <span className="material-icons-outlined">payments</span> Cash
                </label>
                <label className="pdp-pay-method-option">
                  <input type="radio" name="remitPayMethod" value="GCash" checked={payMethod === 'GCash'} onChange={() => setPayMethod('GCash')} />
                  <span className="material-icons-outlined">smartphone</span> GCash
                </label>
              </div>
              <button type="button" className="btn-primary" disabled={submitting} onClick={confirmPay}>
                {submitting ? 'Processing...' : 'Confirm Remit'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Tab 2: History ───────────────────────────
function RemitHistoryTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getRemitHistory();
        if (mounted) setRows(data);
      } catch (err) {
        if (mounted) setError(err?.message || 'Failed to load history.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.customerName.toLowerCase().includes(q) || r.orderId.toLowerCase().includes(q) || r.pointPerson.toLowerCase().includes(q));
  }, [rows, search]);

  const total = useMemo(() => filtered.reduce((s, r) => s + r.amount, 0), [filtered]);

  return (
    <div>
      {error && (
        <div className="shift-warning-banner" style={{ background: 'var(--destructive-light)', borderColor: 'var(--destructive)', color: 'var(--destructive)' }}>
          <span className="material-icons-outlined">error_outline</span>
          {error}
        </div>
      )}

      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-icon primary"><span className="material-icons-outlined">receipt_long</span></div>
          <div>
            <div className="summary-label">Total Records</div>
            <div className="summary-value">{filtered.length}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon success"><span className="material-icons-outlined">payments</span></div>
          <div>
            <div className="summary-label">Total Collected</div>
            <div className="summary-value">{formatPeso(total)}</div>
          </div>
        </div>
      </div>

      <div className="remit-toolbar">
        <input type="text" className="search-input" placeholder="Search customer, order ID, point person..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card remit-card">
        <div className="card-body remit-table-wrap">
          <table className="data-table" style={{ minWidth: 800 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Order ID</th>
                <th>Customer</th>
                <th>Point Person</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Label</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40 }}>Loading...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--muted-fg)' }}>No remit history yet.</td></tr>
              )}
              {!loading && filtered.map((r) => (
                <tr key={r.id}>
                  <td data-label="Date"><div>{r.date}</div><div style={{ fontSize: 11, color: 'var(--muted-fg)' }}>{r.time}</div></td>
                  <td data-label="Order ID" style={{ fontSize: 12, color: 'var(--muted-fg)' }}>{r.orderId}</td>
                  <td data-label="Customer" style={{ fontWeight: 700 }}>{r.customerName}</td>
                  <td data-label="Point Person">{r.pointPerson || '--'}</td>
                  <td data-label="Amount" style={{ fontWeight: 700 }}>{formatPeso(r.amount)}</td>
                  <td data-label="Method">
                    <span className={`mop-tag ${r.paymentMethod === 'GCash' ? 'mop-tag-gcash' : 'mop-tag-cash'}`}>
                      <span className="material-icons-outlined">{r.paymentMethod === 'GCash' ? 'smartphone' : 'payments'}</span>{r.paymentMethod}
                    </span>
                  </td>
                  <td data-label="Label">
                    <span className={`badge ${r.label === 'Remit' ? 'badge-success' : 'badge-warning'}`}>{r.label}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Tab 3: By Point Person ───────────────────────────
function RemitByPersonTab() {
  const [remitRows, setRemitRows] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFilter, setDateFilter] = useState('today');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [remit, history] = await Promise.all([getRemitData(), getRemitHistory()]);
        if (mounted) { setRemitRows(remit); setHistoryRows(history); }
      } catch (err) {
        if (mounted) setError(err?.message || 'Failed to load summary.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const groups = useMemo(() => {
    const today = todayISO();
    const yesterday = yesterdayISO();
    const matchDate = (d) => (dateFilter === 'all' ? true : dateFilter === 'today' ? d === today : d === yesterday);

    const byPerson = {};
    remitRows.filter((r) => matchDate(r.deliveredDate)).forEach((r) => {
      const key = r.pointPerson || 'No Point Person';
      if (!byPerson[key]) byPerson[key] = { name: key, delivered: 0, deliveredValue: 0, remitted: 0, outstanding: 0 };
      byPerson[key].delivered += 1;
      byPerson[key].deliveredValue += r.total;
      byPerson[key].outstanding += r.balance;
    });
    historyRows.filter((r) => matchDate(r.rawDate)).forEach((r) => {
      const key = r.pointPerson || 'No Point Person';
      if (!byPerson[key]) byPerson[key] = { name: key, delivered: 0, deliveredValue: 0, remitted: 0, outstanding: 0 };
      byPerson[key].remitted += r.amount;
    });

    return Object.values(byPerson).sort((a, b) => a.name.localeCompare(b.name));
  }, [remitRows, historyRows, dateFilter]);

  return (
    <div>
      {error && (
        <div className="shift-warning-banner" style={{ background: 'var(--destructive-light)', borderColor: 'var(--destructive)', color: 'var(--destructive)' }}>
          <span className="material-icons-outlined">error_outline</span>
          {error}
        </div>
      )}

      <div className="remit-toolbar">
        <div className="remit-toolbar-row">
          <span className="remit-toolbar-label"><span className="material-icons-outlined">event</span>Period</span>
          <div className="remit-date-tabs">
            {['today', 'yesterday', 'all'].map((val) => (
              <button key={val} type="button" className={`filter-tab${dateFilter === val ? ' active' : ''}`} onClick={() => setDateFilter(val)}>
                {val === 'today' ? 'Today' : val === 'yesterday' ? 'Yesterday' : 'All'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && <div style={{ padding: '60px 0', textAlign: 'center' }}><div className="spinner" /></div>}
      {!loading && groups.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted-fg)' }}>No activity for this period.</div>
      )}

      <div className="remit-person-grid">
        {!loading && groups.map((g) => (
          <div className="remit-person-card" key={g.name}>
            <div className="remit-person-head">
              <span className="remit-person-avatar">{g.name.charAt(0).toUpperCase()}</span>
              <span className="remit-person-name">{g.name}</span>
            </div>
            <div className="remit-person-stats">
              <div className="remit-person-stat">
                <span className="remit-person-stat-label">Delivered</span>
                <span className="remit-person-stat-val">{g.delivered} orders</span>
              </div>
              <div className="remit-person-stat">
                <span className="remit-person-stat-label">Remitted</span>
                <span className="remit-person-stat-val remit-person-stat-success">{formatPeso(g.remitted)}</span>
              </div>
              <div className="remit-person-stat">
                <span className="remit-person-stat-label">Outstanding</span>
                <span className={`remit-person-stat-val ${g.outstanding > 0 ? 'remit-person-stat-danger' : ''}`}>{formatPeso(g.outstanding)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}