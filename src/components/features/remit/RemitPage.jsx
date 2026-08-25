import { useEffect, useMemo, useState } from 'react';
import { getRemitData, remitOrderPayment } from '../../../api/remit.js';
import { formatPeso } from '../../../utils/format.js';
import { showToast } from '../../../utils/toast.js';
import './remit.css';

export default function RemitPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [payTarget, setPayTarget] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await getRemitData());
    } catch (err) {
      setError(err?.message || 'Failed to load remit data.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const matchQ = !q || r.customerName.toLowerCase().includes(q) || r.orderId.toLowerCase().includes(q) || r.pointPerson.toLowerCase().includes(q);
      const matchStatus = !statusFilter || r.paymentStatus.toLowerCase() === statusFilter;
      return matchQ && matchStatus;
    });
  }, [rows, search, statusFilter]);

  const totalOutstanding = useMemo(() => filtered.reduce((s, r) => s + r.balance, 0), [filtered]);

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

  return (
    <div className="page-content remit-page">
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
            <div className="summary-label">Delivered Orders</div>
            <div className="summary-value">{filtered.length}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon danger"><span className="material-icons-outlined">move_to_inbox</span></div>
          <div>
            <div className="summary-label">Awaiting Remit</div>
            <div className="summary-value text-danger">{formatPeso(totalOutstanding)}</div>
          </div>
        </div>
      </div>

      <div className="remit-toolbar">
        <input
          type="text"
          className="search-input"
          placeholder="Search customer, order ID, point person..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="filter-person-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="utang">Utang</option>
        </select>
      </div>

      <div className="card remit-card">
        <div className="card-body remit-table-wrap">
          <table className="data-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Total</th>
                <th>Balance</th>
                <th>Delivery</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40 }}>Loading...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--muted-fg)' }}>No delivered orders found.</td></tr>
              )}
              {!loading && filtered.map((r) => (
                <tr key={r.orderId}>
                  <td data-label="Order ID" style={{ fontSize: 12, color: 'var(--muted-fg)' }}>{r.orderId}</td>
                  <td data-label="Date"><div>{r.date}</div><div style={{ fontSize: 11, color: 'var(--muted-fg)' }}>{r.time}</div></td>
                  <td data-label="Customer" style={{ fontWeight: 700 }}>{r.customerName}{r.location ? ` — ${r.location}` : ''}</td>
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