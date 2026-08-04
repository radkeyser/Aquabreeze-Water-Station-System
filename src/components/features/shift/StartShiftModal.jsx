import { useState } from 'react';
import { startShift } from '../../../api/shift.js';
import { formatPeso } from '../../../utils/format.js';
import { showToast } from '../../../utils/toast.js';
import { useShift } from '../../../context/ShiftContext.jsx';

export default function StartShiftModal() {
  const { startModalOpen, setStartModalOpen, refreshShift, pendingTarget, setPendingTarget } = useShift();
  const [bills, setBills] = useState('');
  const [coins, setCoins] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!startModalOpen) return null;

  const total = (parseFloat(bills) || 0) + (parseFloat(coins) || 0);

  function close() {
    setStartModalOpen(false);
    setBills(''); setCoins('');
  }

  async function handleConfirm() {
    setSubmitting(true);
    try {
      const result = await startShift(total);
      if (result.success) {
        await refreshShift();
        close();
        if (pendingTarget) { pendingTarget(); setPendingTarget(null); }
      } else {
        showToast(result.message);
      }
    } catch (err) {
      showToast('Error: ' + (err?.message || 'Unknown'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pay-modal-overlay show">
      <div className="pay-modal" style={{ maxWidth: 420 }}>
        <div className="pay-modal-header">
          <div className="pay-modal-title">
            <span className="material-icons-outlined" style={{ verticalAlign: 'middle', marginRight: 6, fontSize: 20 }}>play_circle</span>
            Start New Shift
          </div>
          <button type="button" className="pdp-close-btn" onClick={close}><span className="material-icons-outlined">close</span></button>
        </div>
        <div className="pay-modal-body">
          <div className="pay-modal-info">
            <div className="pay-modal-customer">Enter starting cash to begin your shift.</div>
          </div>
          <div className="pdp-field">
            <label className="pdp-label">Starting Cash (Bills)</label>
            <input type="number" className="pdp-input" placeholder="0.00" min="0" value={bills} onChange={(e) => setBills(e.target.value)} />
          </div>
          <div className="pdp-field">
            <label className="pdp-label">Starting Coins</label>
            <input type="number" className="pdp-input" placeholder="0.00" min="0" step="0.01" value={coins} onChange={(e) => setCoins(e.target.value)} />
          </div>
          <div className="denom-total-row" style={{ marginBottom: 16 }}>
            <span>Total Starting Cash</span>
            <span className="denom-total-val">{formatPeso(total)}</span>
          </div>
          <button type="button" className="btn-primary" disabled={submitting} onClick={handleConfirm}>
            <span className="material-icons-outlined" style={{ fontSize: 17, verticalAlign: 'middle' }}>play_arrow</span> {submitting ? 'Starting...' : 'Start Shift'}
          </button>
        </div>
      </div>
    </div>
  );
}