import { useEffect, useMemo, useState } from 'react';
import { getPayrollHistory } from '../../../api/payroll.js';
import { formatPeso } from '../../../utils/format.js';

export default function PayrollHistoryTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getPayrollHistory();
        if (mounted) setRows(data);
      } catch (err) {
        if (mounted) setError(err?.message || 'Failed to load payroll history.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.staffName.toLowerCase().includes(q) || r.role.toLowerCase().includes(q));
  }, [rows, search]);

  const totalReleased = useMemo(() => filtered.reduce((s, r) => s + r.expectedSalary, 0), [filtered]);

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
          <div className="summary-icon primary"><span className="material-icons-outlined">history</span></div>
          <div>
            <div className="summary-label">Total Records</div>
            <div className="summary-value">{filtered.length}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon success"><span className="material-icons-outlined">payments</span></div>
          <div>
            <div className="summary-label">Total Released</div>
            <div className="summary-value">{formatPeso(totalReleased)}</div>
          </div>
        </div>
      </div>

      <div className="payroll-header">
        <div className="card-title">
          <span className="material-icons-outlined">history</span>
          <span>Payroll History</span>
        </div>
        <input
          type="text"
          className="search-input"
          placeholder="Search staff or role..."
          style={{ maxWidth: 260 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card payroll-card">
        <div className="card-body payroll-table-wrap">
          <table className="data-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Date Released</th>
                <th>Staff</th>
                <th>Role</th>
                <th>Days</th>
                <th>Rate</th>
                <th>Advance</th>
                <th>Commission</th>
                <th>Debt Charge</th>
                <th>Net Pay</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40 }}>Loading...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 40, color: 'var(--muted-fg)' }}>No payroll history yet.</td></tr>
              )}
              {!loading && filtered.map((r) => (
                <tr key={r.id}>
                  <td data-label="Date Released">
                    <div>{r.dateReleased}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted-fg)' }}>{r.timeReleased}</div>
                  </td>
                  <td data-label="Staff" style={{ fontWeight: 700 }}>{r.staffName}</td>
                  <td data-label="Role">{r.role || '--'}</td>
                  <td data-label="Days">{r.daysWorked}</td>
                  <td data-label="Rate">{formatPeso(r.dailyRate)}</td>
                  <td data-label="Advance">{r.advance > 0 ? formatPeso(r.advance) : '--'}</td>
                  <td data-label="Commission">{r.commission > 0 ? formatPeso(r.commission) : '--'}</td>
                  <td data-label="Debt Charge">{r.debtCharge > 0 ? <span className="text-danger">{formatPeso(r.debtCharge)}</span> : '--'}</td>
                  <td data-label="Net Pay" style={{ fontWeight: 800 }}>{formatPeso(r.expectedSalary)}</td>
                  <td data-label="Details">
                    <button type="button" className="payroll-eye-btn" onClick={() => setDetail(r)} title="View released items">
                      <span className="material-icons-outlined">visibility</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={`pay-modal-overlay${detail ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 500, maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
          <div className="pay-modal-header" style={{ flexShrink: 0 }}>
            <div className="pay-modal-title">{detail?.staffName} — {detail?.dateReleased}</div>
            <button type="button" className="pdp-close-btn" onClick={() => setDetail(null)}><span className="material-icons-outlined">close</span></button>
          </div>
          {detail && (
            <div className="pay-modal-body" style={{ overflowY: 'auto', flex: 1 }}>
              <div className="pay-modal-info" style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--muted-fg)' }}>Net Pay</span>
                  <strong>{formatPeso(detail.expectedSalary)}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: 'var(--muted-fg)' }}>Days × Rate</span>
                  <span>{detail.daysWorked} × {formatPeso(detail.dailyRate)}</span>
                </div>
                {detail.advance > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ color: 'var(--muted-fg)' }}>Advance</span><span>-{formatPeso(detail.advance)}</span></div>}
                {detail.commission > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ color: 'var(--muted-fg)' }}>Commission</span><span>+{formatPeso(detail.commission)}</span></div>}
                {detail.debtCharge > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ color: 'var(--muted-fg)' }}>Debt Charge</span><span className="text-danger">-{formatPeso(detail.debtCharge)}</span></div>}
                {detail.sss > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ color: 'var(--muted-fg)' }}>SSS</span><span>-{formatPeso(detail.sss)}</span></div>}
                {detail.pagibig > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><span style={{ color: 'var(--muted-fg)' }}>Pag-IBIG</span><span>-{formatPeso(detail.pagibig)}</span></div>}
                {detail.philhealth > 0 && <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--muted-fg)' }}>PhilHealth</span><span>-{formatPeso(detail.philhealth)}</span></div>}
              </div>

              {detail.releasedPautang.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-fg)', marginBottom: 8 }}>
                    Debts Cleared ({detail.releasedPautang.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                    {detail.releasedPautang.map((p, i) => (
                      <div key={i} className="payroll-charge-debt-item">
                        <div className="payroll-charge-debt-row">
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700 }}>{p.customer_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted-fg)' }}>{p.order_id}</div>
                          </div>
                          <span style={{ fontWeight: 800 }}>{formatPeso(p.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {detail.releasedCommissions.length > 0 && (
                <>
                  <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted-fg)', marginBottom: 8 }}>
                    Commissions Paid ({detail.releasedCommissions.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {detail.releasedCommissions.map((c, i) => (
                      <div key={i} className="payroll-charge-debt-item">
                        <div className="payroll-charge-debt-row">
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700 }}>{c.customer_name}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted-fg)' }}>{c.product} × {c.quantity}</div>
                          </div>
                          <span style={{ fontWeight: 800 }}>{formatPeso(c.total_commission)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {detail.releasedPautang.length === 0 && detail.releasedCommissions.length === 0 && (
                <div style={{ textAlign: 'center', padding: 20, color: 'var(--muted-fg)', fontSize: 13 }}>
                  No debts or commissions were cleared with this release.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}