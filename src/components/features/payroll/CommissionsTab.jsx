import { useEffect, useMemo, useState } from 'react';
import { getCommissionsDetail } from '../../../api/payroll.js';
import { formatPeso } from '../../../utils/format.js';

function StatusBadge({ delivered }) {
  if (delivered === 'Delivered') {
    return <span className="badge badge-success">Delivered</span>;
  }
  if (delivered === 'Partial') {
    return <span className="badge badge-warning">Partial</span>;
  }
  return <span className="badge badge-danger">Undelivered</span>;
}

function StaffGroup({ group, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const isCommissionBased = group.type === 'Commission-Based';

  return (
    <div className="commission-group">
      <button type="button" className="commission-group-head" onClick={() => setOpen((o) => !o)}>
        <div className="commission-group-identity">
          <span className="commission-group-avatar">{group.name.charAt(0).toUpperCase()}</span>
          <div>
            <div className="commission-group-name">{group.name}</div>
            <div className="commission-group-sub">{group.role || 'No role'} · {group.type}</div>
          </div>
        </div>
        <div className="commission-group-totals">
          <div className="commission-total-item">
            <span className="commission-total-label">Payable</span>
            <span className="commission-total-val commission-total-payable">{formatPeso(group.payableTotal)}</span>
          </div>
          <div className="commission-total-item">
            <span className="commission-total-label">Locked</span>
            <span className="commission-total-val commission-total-locked">{formatPeso(group.lockedTotal)}</span>
          </div>
        </div>
        <span className="material-icons-outlined commission-group-chevron">{open ? 'expand_less' : 'expand_more'}</span>
      </button>

      {open && (
        <div className="commission-group-body">
          {isCommissionBased && (
            <div className="commission-rate-strip">
              <span>5 Gal: <strong>{formatPeso(group.commission5Gal)}</strong></span>
              <span>1000mL: <strong>{formatPeso(group.commission1000mL)}</strong></span>
              <span>500mL: <strong>{formatPeso(group.commission500mL)}</strong></span>
              <span>Slim Gal: <strong>{formatPeso(group.commissionSlim)}</strong></span>
            </div>
          )}
          <div className="commission-table-wrap">
            <table className="data-table" style={{ minWidth: 700 }}>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {group.entries.map((e, i) => (
                  <tr key={`${e.orderId}-${i}`}>
                    <td data-label="Order ID" style={{ fontSize: 12, color: 'var(--muted-fg)' }}>{e.orderId}</td>
                    <td data-label="Date">{e.date}</td>
                    <td data-label="Customer">{e.customerName}{e.location ? ` — ${e.location}` : ''}</td>
                    <td data-label="Product">{e.product}</td>
                    <td data-label="Qty">{e.quantity}</td>
                    <td data-label="Amount" style={{ fontWeight: 700 }}>{formatPeso(e.amount)}</td>
                    <td data-label="Status"><StatusBadge delivered={e.delivered} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CommissionsTab() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getCommissionsDetail();
        if (mounted) setGroups(data);
      } catch (err) {
        if (mounted) setError(err?.message || 'Failed to load commissions.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q) || g.role.toLowerCase().includes(q));
  }, [groups, search]);

  const summary = useMemo(() => {
    const payable = filtered.reduce((s, g) => s + g.payableTotal, 0);
    const locked = filtered.reduce((s, g) => s + g.lockedTotal, 0);
    return { payable, locked, staffCount: filtered.length };
  }, [filtered]);

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
          <div className="summary-icon success"><span className="material-icons-outlined">paid</span></div>
          <div>
            <div className="summary-label">Payable Commission</div>
            <div className="summary-value">{formatPeso(summary.payable)}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon danger"><span className="material-icons-outlined">lock_clock</span></div>
          <div>
            <div className="summary-label">Locked (Undelivered)</div>
            <div className="summary-value text-danger">{formatPeso(summary.locked)}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon primary"><span className="material-icons-outlined">groups</span></div>
          <div>
            <div className="summary-label">Staff Earning Commission</div>
            <div className="summary-value">{summary.staffCount}</div>
          </div>
        </div>
      </div>

      <div className="payroll-header">
        <div className="card-title">
          <span className="material-icons-outlined">percent</span>
          <span>Commissions</span>
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

      {loading && (
        <div style={{ padding: '60px 0', textAlign: 'center' }}><div className="spinner" /></div>
      )}
      {!loading && filtered.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--muted-fg)' }}>No commission activity found.</div>
      )}
      {!loading && filtered.map((g, idx) => (
        <StaffGroup key={g.name} group={g} defaultOpen={idx === 0} />
      ))}
    </div>
  );
}