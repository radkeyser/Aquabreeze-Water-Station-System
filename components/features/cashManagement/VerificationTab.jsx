import { useEffect, useMemo, useState } from 'react';
import { getShiftVerificationData, verifyShiftCash } from '../../../src/api/cashManagement.js';
import { formatPeso } from '../../../src/utils/format.js';
import { showToast as notify } from '../../../src/utils/toast.js';

const DENOMS = [
  { key: '1000', label: '₱1,000', val: 1000 }, { key: '500', label: '₱500', val: 500 },
  { key: '200', label: '₱200', val: 200 }, { key: '100', label: '₱100', val: 100 },
  { key: '50', label: '₱50', val: 50 }, { key: '20', label: '₱20', val: 20 },
  { key: 'coins', label: 'Coins', val: 1 },
];

export default function VerificationTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const showToast = (m) => notify(m);

  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [verifyTarget, setVerifyTarget] = useState(null);
  const [denoms, setDenoms] = useState({});
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setData(await getShiftVerificationData()); } catch { showToast('Failed to load.'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const shifts = data?.shifts || [];

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
    return shifts.filter((s) => {
      const text = Object.values(s).join(' ').toLowerCase();
      return (!q || text.includes(q)) && (!from || s.date >= from) && (!to || s.date <= to);
    });
  }, [shifts, search, dateFilter, customFrom, customTo]);

  function openVerify(shift) { setVerifyTarget(shift); setDenoms({}); setRemarks(''); }
  function closeVerify() { setVerifyTarget(null); }

  const total = DENOMS.reduce((s, d) => {
    const qty = parseFloat(denoms[d.key]) || 0;
    return s + (d.key === 'coins' ? qty : qty * d.val);
  }, 0);

  async function handleConfirmVerify() {
    if (!verifyTarget) return;
    setSubmitting(true);
    try {
      const res = await verifyShiftCash({ shiftId: verifyTarget.shiftId, verifiedCount: total, remarks: remarks.trim() });
      showToast(res.message);
      if (res.success) { closeVerify(); await load(); }
    } catch (err) { showToast(err?.message || 'Error'); }
    setSubmitting(false);
  }

  if (loading) return <div style={{ padding: '80px 0', textAlign: 'center' }}><div className="spinner" /></div>;

  return (
    <div>
      <div className="cash-section-hdr">
        <div>
          <div className="cash-section-title"><span className="material-icons-outlined">verified</span> Shift Cash Verification</div>
          <div className="cash-section-sub">Verify shift cash to add it to Cash on Hand balance</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <input type="text" className="search-input" placeholder="Search shift ID, date, status..." style={{ flex: 1, minWidth: 160 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="filter-person-select" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
          <option value="all">All Time</option><option value="today">Today</option><option value="week">This Week</option><option value="month">This Month</option><option value="custom">Custom Range</option>
        </select>
        {dateFilter === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="date" className="pdp-input" style={{ width: 140, fontSize: 13 }} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span style={{ fontSize: 13, color: 'var(--muted-fg)' }}>to</span>
            <input type="date" className="pdp-input" style={{ width: 140, fontSize: 13 }} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}
      </div>

      <div className="card"><div className="card-body" style={{ overflowX: 'auto', padding: '12px 20px' }}>
        <table className="data-table cash-shift-table" style={{ minWidth: 1100, tableLayout: 'fixed', width: '100%' }}>
          <thead><tr>
            <th style={{ width: 130, textAlign: 'left' }}>Shift ID</th>
            <th style={{ width: 120, textAlign: 'center' }}>Date</th>
            <th style={{ width: 100, textAlign: 'center' }}>Time</th>
            <th style={{ width: 130, textAlign: 'right' }}>Expected</th>
            <th style={{ width: 140, textAlign: 'right' }}>Declared Count</th>
            <th style={{ width: 140, textAlign: 'right' }}>Verified Count</th>
            <th style={{ width: 130, textAlign: 'center' }}>Variance</th>
            <th style={{ width: 110, textAlign: 'center' }}>Status</th>
            <th style={{ width: 200, textAlign: 'left' }}>Remarks</th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 48, color: 'var(--muted-fg)' }}>No closed shifts found.</td></tr>
            ) : filtered.map((s) => {
              const varStyle = { color: s.variance < 0 ? 'var(--destructive)' : s.variance > 0 ? 'hsl(150,45%,38%)' : 'var(--muted-fg)' };
              return (
                <tr key={s.shiftId}>
                  <td style={{ fontSize: 12, color: 'var(--muted-fg)' }}>{s.shiftId}</td>
                  <td style={{ textAlign: 'center' }}>{s.date}</td>
                  <td style={{ textAlign: 'center', color: 'var(--muted-fg)' }}>{s.time}</td>
                  <td style={{ textAlign: 'right' }}>{formatPeso(s.expectedCash)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatPeso(s.declaredCount)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{s.verified ? formatPeso(s.verifiedCount) : '--'}</td>
                  <td style={{ textAlign: 'center', fontWeight: 700, ...varStyle }}>{s.verified ? `${s.variance >= 0 ? '+' : ''}${formatPeso(s.variance)}` : '--'}</td>
                  <td style={{ textAlign: 'center' }}>
                    {s.verified ? (
                      <span className="cash-verified-badge"><span className="material-icons-outlined">check_circle</span> Verified</span>
                    ) : (
                      <button type="button" className="cash-verify-btn" onClick={() => openVerify(s)}><span className="material-icons-outlined" style={{ fontSize: 14 }}>verified</span> Verify</button>
                    )}
                  </td>
                  <td style={{ fontSize: 12, color: 'var(--muted-fg)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.remarks || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div></div>

      <div className={`pay-modal-overlay${verifyTarget ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 460, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div className="pay-modal-header" style={{ flexShrink: 0 }}>
            <div className="pay-modal-title"><span className="material-icons-outlined" style={{ verticalAlign: 'middle', marginRight: 6 }}>verified</span>Verify Shift Cash</div>
            <button type="button" className="pdp-close-btn" onClick={closeVerify}><span className="material-icons-outlined">close</span></button>
          </div>
          {verifyTarget && (
            <div className="pay-modal-body" style={{ overflowY: 'auto', flex: 1 }}>
              <div className="pay-modal-customer" style={{ marginBottom: 12 }}>Shift: {verifyTarget.shiftId}</div>
              <div style={{ marginBottom: 14 }}>
                <div className="cash-conf-row"><span className="cash-conf-label">Date</span><span className="cash-conf-val">{verifyTarget.date}</span></div>
                <div className="cash-conf-row"><span className="cash-conf-label">Time</span><span className="cash-conf-val">{verifyTarget.time}</span></div>
                <div className="cash-conf-row"><span className="cash-conf-label">Expected Cash</span><span className="cash-conf-val">{formatPeso(verifyTarget.expectedCash)}</span></div>
                <div className="cash-conf-row"><span className="cash-conf-label">Declared Count</span><span className="cash-conf-val">{formatPeso(verifyTarget.declaredCount)}</span></div>
              </div>
              <div className="pdp-field">
                <label className="pdp-label">Count Your Cash (Verified Count)</label>
                <div className="denom-grid">
                  {DENOMS.map((d) => {
                    const qty = parseFloat(denoms[d.key]) || 0;
                    const sub = d.key === 'coins' ? qty : qty * d.val;
                    return (
                      <div className="denom-row" key={d.key}>
                        <span className="denom-label">{d.label}</span>
                        <input type="number" className="pdp-input denom-input" min="0" step={d.key === 'coins' ? '0.01' : '1'} value={denoms[d.key] || ''} onChange={(e) => setDenoms((prev) => ({ ...prev, [d.key]: e.target.value }))} />
                        <span className="denom-subtotal">{formatPeso(sub)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="denom-total-row"><span>Verified Total</span><span className="denom-total-val">{formatPeso(total)}</span></div>
              </div>
              <div className="pdp-field">
                <label className="pdp-label">Remarks (optional)</label>
                <textarea className="pdp-input" rows={2} style={{ resize: 'vertical' }} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn-cancel-delete" onClick={closeVerify}>Cancel</button>
                <button type="button" className="btn-primary" style={{ flex: 1 }} disabled={submitting} onClick={handleConfirmVerify}>
                  <span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>verified</span> {submitting ? 'Verifying...' : 'Confirm & Add to Cash'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}