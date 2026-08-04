import { useEffect, useState } from 'react';
import { getCashManagementData, getBankReconciliationData, saveBankReconciliation } from '../../../api/cashManagement.js';
import { formatPeso } from '../../../utils/format.js';
import { showToast as notify } from '../../../utils/toast.js';
import TransactionTable from './TransactionTable.jsx';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function ReconciliationTab() {
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [month, setMonth] = useState(defaultMonth);
  const [banks, setBanks] = useState([]);
  const [selectedBank, setSelectedBank] = useState('');
  const [recon, setRecon] = useState(null);
  const [loading, setLoading] = useState(true);
  const showToast = (m) => notify(m);

  const [interest, setInterest] = useState('0');
  const [unrecorded, setUnrecorded] = useState('0');
  const [correction, setCorrection] = useState('0');
  const [bookNotes, setBookNotes] = useState('');
  const [bankEnding, setBankEnding] = useState('0');
  const [depositTransit, setDepositTransit] = useState('0');
  const [bankNotes, setBankNotes] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCashManagementData().then((d) => {
      const bankAccs = d.accounts.filter((a) => a.type === 'Bank');
      setBanks(bankAccs);
      setSelectedBank((prev) => prev || bankAccs[0]?.name || '');
    }).catch(() => showToast('Failed to load accounts.', { type: 'error' }));
  }, []);

  useEffect(() => {
    if (!selectedBank) { setLoading(false); return; }
    loadRecon();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, selectedBank]);

  async function loadRecon() {
    setLoading(true);
    try {
      const d = await getBankReconciliationData(month, selectedBank);
      setRecon(d);
      const ex = d.existing;
      setInterest(String(ex?.interestIncome || 0));
      setUnrecorded(String(ex?.unrecordedDeposit || 0));
      setCorrection(String(ex?.correction || 0));
      setBookNotes(ex?.bookNotes || '');
      setBankEnding(String(ex?.bankEndingBalance || 0));
      setDepositTransit(String(ex?.depositInTransit || 0));
      setBankNotes(ex?.bankNotes || '');
    } catch { showToast('Failed to load reconciliation.', { type: 'error' }); }
    setLoading(false);
  }

  if (loading || !recon) return <div style={{ padding: '80px 0', textAlign: 'center' }}><div className="spinner" /></div>;

  const ex = recon.existing;
  const isLocked = !!ex?.isBalanced;
  const bankAcc = banks.find((b) => b.name === selectedBank);
  const bk = bankAcc ? bankAcc.balance : recon.bookEnding || 0;

  const intNum = parseFloat(interest) || 0;
  const unrNum = parseFloat(unrecorded) || 0;
  const corNum = parseFloat(correction) || 0;
  const bkEndNum = parseFloat(bankEnding) || 0;
  const depNum = parseFloat(depositTransit) || 0;

  const bookTotal = isLocked ? (ex.bookTotal || (bk + intNum + unrNum - corNum)) : bk + intNum + unrNum - corNum;
  const bankTotal = isLocked ? (ex.bankTotal || (bkEndNum + depNum)) : bkEndNum + depNum;
  const balanced = Math.abs(bookTotal - bankTotal) < 0.01;

  const parts = month.split('-');
  const yrNum = parseInt(parts[0], 10);
  const moIdx = parseInt(parts[1], 10) - 1;

  function handleSaveClick() {
    if (!balanced) { showToast('Book and Bank totals must match before saving.', { type: 'error' }); return; }
    setConfirmOpen(true);
  }

  async function handleConfirmSave() {
    setSubmitting(true);
    try {
      const res = await saveBankReconciliation({
        month, selectedBank, bookEnding: bk, interestIncome: intNum, unrecordedDeposit: unrNum,
        correction: corNum, bookNotes, bankEndingBalance: bkEndNum, depositInTransit: depNum, bankNotes,
      });
      showToast(res.message, { type: 'success' });
      if (res.success) { setConfirmOpen(false); await loadRecon(); }
    } catch (err) { showToast(err?.message || 'Error', { type: 'error' }); }
    setSubmitting(false);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <select className="filter-person-select" style={{ fontSize: 14, fontWeight: 700, minWidth: 180 }} value={selectedBank} onChange={(e) => setSelectedBank(e.target.value)}>
          {banks.length ? banks.map((b) => <option key={b.id} value={b.name}>{b.name}</option>) : <option value="">No bank accounts</option>}
        </select>
        <input type="month" className="pdp-input" style={{ width: 180, fontSize: 14, fontWeight: 700 }} value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
        {isLocked && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: 'hsl(150,45%,38%)', background: 'hsla(150,45%,42%,0.1)', padding: '6px 12px', borderRadius: 8 }}>
            <span className="material-icons-outlined" style={{ fontSize: 16 }}>lock</span> Locked
          </span>
        )}
      </div>

      <div className={`cash-recon-status ${isLocked || balanced ? 'cash-recon-balanced' : 'cash-recon-unbalanced'}`}>
        <span className="material-icons-outlined">{isLocked || balanced ? 'check_circle' : 'info'}</span>
        {isLocked ? 'Reconciliation is balanced and locked.' : balanced ? 'Reconciliation is balanced.' : 'Not yet balanced. Adjust the fields until both totals match.'}
      </div>

      <div className="cash-recon-grid">
        <div className="cash-recon-side">
          <div className="cash-recon-side-header">📖 Book</div>
          <div className="cash-recon-row"><span className="cash-recon-label">+ Ending Balance (Auto)</span><span className="cash-recon-val cash-recon-auto">{formatPeso(bk)}</span></div>
          <div className="cash-recon-row"><span className="cash-recon-label">+ Interest Income</span><div className="cash-recon-input-wrap"><input type="number" className="cash-recon-input" min="0" disabled={isLocked} value={interest} onChange={(e) => setInterest(e.target.value)} /></div></div>
          <div className="cash-recon-row"><span className="cash-recon-label">+ Unrecorded Deposit</span><div className="cash-recon-input-wrap"><input type="number" className="cash-recon-input" min="0" disabled={isLocked} value={unrecorded} onChange={(e) => setUnrecorded(e.target.value)} /></div></div>
          <div className="cash-recon-row"><span className="cash-recon-label">- Correction</span><div className="cash-recon-input-wrap"><input type="number" className="cash-recon-input" min="0" disabled={isLocked} value={correction} onChange={(e) => setCorrection(e.target.value)} /></div></div>
          <div className="cash-recon-total"><span>Book Total</span><span className="cash-recon-total-val">{formatPeso(bookTotal)}</span></div>
          <div style={{ padding: '10px 16px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea className="pdp-input" rows={3} style={{ fontSize: 13, resize: 'vertical' }} disabled={isLocked} value={bookNotes} onChange={(e) => setBookNotes(e.target.value)} />
          </div>
        </div>
        <div className="cash-recon-side">
          <div className="cash-recon-side-header">🏦 Bank</div>
          <div className="cash-recon-row"><span className="cash-recon-label">+ Ending Balance (Manual)</span><div className="cash-recon-input-wrap"><input type="number" className="cash-recon-input" min="0" disabled={isLocked} value={bankEnding} onChange={(e) => setBankEnding(e.target.value)} /></div></div>
          <div className="cash-recon-row"><span className="cash-recon-label">+ Deposit in Transit</span><div className="cash-recon-input-wrap"><input type="number" className="cash-recon-input" min="0" disabled={isLocked} value={depositTransit} onChange={(e) => setDepositTransit(e.target.value)} /></div></div>
          <div className="cash-recon-total"><span>Bank Total</span><span className="cash-recon-total-val">{formatPeso(bankTotal)}</span></div>
          <div style={{ padding: '10px 16px' }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea className="pdp-input" rows={3} style={{ fontSize: 13, resize: 'vertical' }} disabled={isLocked} value={bankNotes} onChange={(e) => setBankNotes(e.target.value)} />
          </div>
        </div>
      </div>

      {!isLocked && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <button type="button" className="cash-btn-primary" onClick={handleSaveClick}><span className="material-icons-outlined">save</span> Save Reconciliation</button>
        </div>
      )}

      <div className="cash-section-hdr" style={{ marginTop: 8 }}><div className="cash-section-title"><span className="material-icons-outlined">receipt_long</span> Bank Transactions — {MONTHS[moIdx]} {yrNum}</div></div>
      <TransactionTable transactions={recon.bankTx.map((t) => ({ ...t, from: t.bank, to: '' }))} showFilters={false} />

      <div className={`pay-modal-overlay${confirmOpen ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 420 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title"><span className="material-icons-outlined" style={{ verticalAlign: 'middle', marginRight: 6 }}>lock</span>Confirm & Lock</div>
            <button type="button" className="pdp-close-btn" onClick={() => setConfirmOpen(false)}><span className="material-icons-outlined">close</span></button>
          </div>
          <div className="pay-modal-body">
            <div style={{ padding: 12, background: 'hsla(0,65%,55%,0.08)', border: '1.5px solid hsla(0,65%,55%,0.2)', borderRadius: 8, marginBottom: 16, fontSize: 13, color: 'var(--destructive)', fontWeight: 600 }}>
              <span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>warning</span> Once saved, this reconciliation will be permanently locked.
            </div>
            <div style={{ marginBottom: 16 }}>
              <div className="cash-conf-row"><span className="cash-conf-label">Month</span><span className="cash-conf-val">{month}</span></div>
              <div className="cash-conf-row"><span className="cash-conf-label">Book Total</span><span className="cash-conf-val">{formatPeso(bookTotal)}</span></div>
              <div className="cash-conf-row"><span className="cash-conf-label">Bank Total</span><span className="cash-conf-val">{formatPeso(bankTotal)}</span></div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn-cancel-delete" onClick={() => setConfirmOpen(false)}>Cancel</button>
              <button type="button" className="btn-primary" style={{ flex: 1 }} disabled={submitting} onClick={handleConfirmSave}>
                <span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>lock</span> {submitting ? 'Locking...' : 'Save & Lock'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}