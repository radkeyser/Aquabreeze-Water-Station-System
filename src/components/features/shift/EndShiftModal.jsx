import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { endShift, checkShiftCloseRequirements } from '../../../api/shift.js';
import { getCashDrawerData } from '../../../api/cashDrawer.js';
import { formatPeso } from '../../../utils/format.js';
import { showToast } from '../../../utils/toast.js';
import { useShift } from '../../../context/ShiftContext.jsx';
import './shift.css';

const DENOMS = [
  { key: '1000', label: '₱1,000', val: 1000 },
  { key: '500', label: '₱500', val: 500 },
  { key: '200', label: '₱200', val: 200 },
  { key: '100', label: '₱100', val: 100 },
  { key: '50', label: '₱50', val: 50 },
  { key: '20', label: '₱20', val: 20 },
  { key: 'coins', label: 'Coins', val: 1 },
];

export default function EndShiftModal() {
  const { endModalOpen, setEndModalOpen, activeShift, refreshShift, setSummaryData } = useShift();
  const navigate = useNavigate();
  const [denoms, setDenoms] = useState({});
  const [expected, setExpected] = useState(0);
  const [loadingExpected, setLoadingExpected] = useState(true);
  const [step, setStep] = useState('count');
  const [submitting, setSubmitting] = useState(false);
  const [requirements, setRequirements] = useState(null);
  const [checkingRequirements, setCheckingRequirements] = useState(true);

  const ZERO_DENOMS = { '1000': '0', '500': '0', '200': '0', '100': '0', '50': '0', '20': '0', coins: '0' };

  useEffect(() => {
    if (!endModalOpen || !activeShift) return;
    setStep('count');
    setDenoms(ZERO_DENOMS);
    setLoadingExpected(true);
    setCheckingRequirements(true);
    setRequirements(null);

    getCashDrawerData()
      .then((data) => setExpected(data?.expectedCash || 0))
      .catch(() => setExpected(0))
      .finally(() => setLoadingExpected(false));

    checkShiftCloseRequirements()
      .then(setRequirements)
      .catch(() => setRequirements({ dailyCountDone: false, meterReadingDone: false }))
      .finally(() => setCheckingRequirements(false));
  }, [endModalOpen, activeShift]);

  if (!endModalOpen) return null;

  const total = DENOMS.reduce((s, d) => {
    const qty = parseFloat(denoms[d.key]) || 0;
    return s + (d.key === 'coins' ? qty : qty * d.val);
  }, 0);
  const diff = total - expected;

  function close() { setEndModalOpen(false); }

  function goToInventoryTab(tab) {
    close();
    navigate('/inventory', { state: { tab } });
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const result = await endShift(total);
      if (result.success) {
        await refreshShift();
        setSummaryData(result);
        close();
      } else {
        showToast(result.message, { type: 'error' });
      }
    } catch (err) {
      showToast('Error: ' + (err?.message || 'Unknown'), { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  const blocked = requirements && (!requirements.dailyCountDone || !requirements.meterReadingDone);

  return (
    <div className="pay-modal-overlay show">
      <div className="pay-modal" style={{ maxWidth: 440, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="pay-modal-header" style={{ flexShrink: 0 }}>
          <div className="pay-modal-title">
            <span className="material-icons-outlined" style={{ verticalAlign: 'middle', marginRight: 6, fontSize: 20 }}>stop_circle</span>
            End Shift
          </div>
          <button type="button" className="pdp-close-btn" onClick={close}><span className="material-icons-outlined">close</span></button>
        </div>
        <div className="pay-modal-body" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
          {checkingRequirements ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}><div className="spinner" /></div>
          ) : blocked ? (
            <div className="shift-blocked">
              <span className="material-icons-outlined shift-blocked-icon">block</span>
              <div className="shift-blocked-title">Cannot End Shift Yet</div>
              <div className="shift-blocked-sub">Complete the following in Inventory before closing this shift:</div>
              <div className="shift-blocked-list">
                {requirements.dailyCountDone ? (
                  <div className="shift-blocked-item shift-blocked-item-done">
                    <span className="material-icons-outlined">check_circle</span>
                    Daily Inventory Count
                  </div>
                ) : (
                  <button type="button" className="shift-blocked-item shift-blocked-item-link" onClick={() => goToInventoryTab('daily')}>
                    <span className="material-icons-outlined">radio_button_unchecked</span>
                    Daily Inventory Count
                    <span className="material-icons-outlined shift-blocked-item-arrow">chevron_right</span>
                  </button>
                )}
                {requirements.meterReadingDone ? (
                  <div className="shift-blocked-item shift-blocked-item-done">
                    <span className="material-icons-outlined">check_circle</span>
                    Meter Reading
                  </div>
                ) : (
                  <button type="button" className="shift-blocked-item shift-blocked-item-link" onClick={() => goToInventoryTab('meter')}>
                    <span className="material-icons-outlined">radio_button_unchecked</span>
                    Meter Reading
                    <span className="material-icons-outlined shift-blocked-item-arrow">chevron_right</span>
                  </button>
                )}
              </div>
              <button type="button" className="btn-cancel-delete" style={{ width: '100%', marginTop: 16 }} onClick={close}>Close</button>
            </div>
          ) : step === 'count' ? (
            <>
              <div className="shift-expected-box">
                <div className="shift-expected-label">Expected Cash in Drawer:</div>
                <div className="shift-expected-val">{loadingExpected ? 'Loading...' : formatPeso(expected)}</div>
              </div>
              <div className="pdp-field">
                <label className="pdp-label">Count Your Cash (Actual)</label>
                <div className="denom-grid">
                  {DENOMS.map((d) => {
                    const qty = parseFloat(denoms[d.key]) || 0;
                    const sub = d.key === 'coins' ? qty : qty * d.val;
                    return (
                      <div className="denom-row" key={d.key}>
                        <span className="denom-label">{d.label}</span>
                        <input
                          type="number"
                          className="pdp-input denom-input"
                          min="0"
                          step={d.key === 'coins' ? '0.01' : '1'}
                          value={denoms[d.key] ?? '0'}
                          onFocus={(e) => { if (e.target.value === '0') e.target.select(); }}
                          onChange={(e) => setDenoms((prev) => ({ ...prev, [d.key]: e.target.value }))}
                        />
                        <span className="denom-subtotal">{formatPeso(sub)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="denom-total-row"><span>Total Actual Cash</span><span className="denom-total-val">{formatPeso(total)}</span></div>
              </div>
              {total > 0 && (
                <div className={`pdp-status-pill ${diff >= 0 ? 'status-paid' : 'status-utang'}`}>
                  <span className="material-icons-outlined">{diff >= 0 ? 'check_circle' : 'warning'}</span>
                  <span>Difference: {diff >= 0 ? '+' : ''}{formatPeso(diff)}</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button type="button" className="btn-cancel-delete" onClick={close}>Cancel</button>
                <button type="button" className="btn-primary" style={{ flex: 1, background: 'var(--destructive)' }} onClick={() => setStep('confirm')}>
                  <span className="material-icons-outlined" style={{ fontSize: 18, verticalAlign: 'middle' }}>stop_circle</span> End Shift
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: 'var(--muted-fg)', marginBottom: 16 }}>Please review before closing the shift.</div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <ConfirmRow label="Expected Cash" value={formatPeso(expected)} />
                <ConfirmRow label="Actual Cash" value={formatPeso(total)} bold />
                <ConfirmRow label="Difference" value={`${diff >= 0 ? '+' : ''}${formatPeso(diff)}`} bold color={diff >= 0 ? 'hsl(150,45%,38%)' : 'var(--destructive)'} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="button" className="btn-cancel-delete" onClick={() => setStep('count')}>Back</button>
                <button type="button" className="btn-primary" style={{ flex: 1, background: 'var(--destructive)' }} disabled={submitting} onClick={handleConfirm}>
                  <span className="material-icons-outlined" style={{ fontSize: 18, verticalAlign: 'middle' }}>stop_circle</span> {submitting ? 'Ending...' : 'Confirm End Shift'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmRow({ label, value, bold, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--muted-fg)', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: bold ? 800 : 400, color: color || 'inherit' }}>{value}</span>
    </div>
  );
}