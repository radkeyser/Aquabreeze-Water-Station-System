import { useEffect, useState } from 'react';
import { getCashManagementData, cashDeposit, cashTransfer } from '../../../api/cashManagement.js';
import { formatPeso } from '../../../utils/format.js';
import { showToast as notify } from '../../../utils/toast.js';
import TransactionTable from './TransactionTable.jsx';

export default function CashTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const showToast = (m) => notify(m);

  const [depositOpen, setDepositOpen] = useState(false);
  const [depositMode, setDepositMode] = useState('business');
  const [depBank, setDepBank] = useState('');
  const [depOtherBank, setDepOtherBank] = useState('');
  const [depAmount, setDepAmount] = useState('');
  const [depAccNum, setDepAccNum] = useState('');
  const [depAccName, setDepAccName] = useState('');
  const [depRef, setDepRef] = useState('');
  const [depDesc, setDepDesc] = useState('');
  const [depSubmitting, setDepSubmitting] = useState(false);

  const [transferOpen, setTransferOpen] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDesc, setTransferDesc] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setData(await getCashManagementData()); } catch { showToast('Failed to load.'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div style={{ padding: '80px 0', textAlign: 'center' }}><div className="spinner" /></div>;
  if (!data) return <div className="empty-state" style={{ padding: 48 }}>Error loading data.</div>;

  const cash = data.accounts.find((a) => a.name === 'Cash') || { balance: 0 };
  const pettyAccs = data.accounts.filter((a) => a.type === 'PettyCash');
  const banks = data.accounts.filter((a) => a.type === 'Bank');
  const txs = data.transactions.filter((t) => t.from === 'Cash' || t.to === 'Cash');

  function openDeposit() {
    setDepositMode('business'); setDepBank(''); setDepOtherBank(''); setDepAmount('');
    setDepAccNum(''); setDepAccName(''); setDepRef(''); setDepDesc('');
    setDepositOpen(true);
  }
  function openTransfer() {
    setTransferTo(pettyAccs[0]?.name || 'Petty Cash'); setTransferAmount(''); setTransferDesc('');
    setTransferOpen(true);
  }

  async function handleDeposit() {
    const isOther = depositMode === 'other';
    const bank = isOther ? depOtherBank.trim() : depBank;
    const amount = parseFloat(depAmount) || 0;
    if (!bank) { showToast(isOther ? 'Please enter a bank name.' : 'Please select a bank.'); return; }
    if (amount <= 0) { showToast('Please enter an amount.'); return; }
    setDepSubmitting(true);
    try {
      const res = await cashDeposit({ bankAccount: bank, amount, accountNumber: depAccNum.trim(), accountName: depAccName.trim(), reference: depRef.trim(), description: depDesc.trim() });
      showToast(res.message);
      if (res.success) { setDepositOpen(false); await load(); }
    } catch (err) { showToast(err?.message || 'Error'); }
    setDepSubmitting(false);
  }

  async function handleTransfer() {
    const amount = parseFloat(transferAmount) || 0;
    if (amount <= 0) { showToast('Please enter an amount.'); return; }
    setTransferSubmitting(true);
    try {
      const res = await cashTransfer({ from: 'Cash', to: transferTo, amount, description: transferDesc.trim() });
      showToast(res.message);
      if (res.success) { setTransferOpen(false); await load(); }
    } catch (err) { showToast(err?.message || 'Error'); }
    setTransferSubmitting(false);
  }

  return (
    <div>
      <div className="cash-ledger-bal">
        <div>
          <div className="cash-ledger-bal-label">Cash on Hand (Verified)</div>
          <div style={{ fontSize: 11, color: 'var(--muted-fg)', marginTop: 2 }}>Unverified POS cash excluded</div>
        </div>
        <div className="cash-ledger-bal-val">{formatPeso(cash.balance)}</div>
      </div>

      <div className="cash-action-bar" style={{ marginBottom: 20 }}>
        {banks.length > 0 && (
          <button type="button" className="cash-btn-primary" onClick={openDeposit}><span className="material-icons-outlined">arrow_upward</span> Deposit to Bank</button>
        )}
        <button type="button" className="cash-btn-outline" onClick={openTransfer}><span className="material-icons-outlined">savings</span> Transfer to Petty Cash</button>
      </div>

      <div className="cash-section-hdr"><div className="cash-section-title"><span className="material-icons-outlined">history</span> Cash Transactions</div></div>
      <TransactionTable transactions={txs} showFilters />

      <div className={`pay-modal-overlay${depositOpen ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 440 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title"><span className="material-icons-outlined" style={{ verticalAlign: 'middle', marginRight: 6 }}>arrow_upward</span>Deposit to Bank</div>
            <button type="button" className="pdp-close-btn" onClick={() => setDepositOpen(false)}><span className="material-icons-outlined">close</span></button>
          </div>
          <div className="pay-modal-body">
            <div style={{ display: 'flex', marginBottom: 16, border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <button type="button" onClick={() => setDepositMode('business')} style={{ flex: 1, padding: 9, border: 'none', background: depositMode === 'business' ? 'var(--primary)' : 'var(--card)', color: depositMode === 'business' ? '#fff' : 'var(--muted-fg)', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Business Account</button>
              <button type="button" onClick={() => setDepositMode('other')} style={{ flex: 1, padding: 9, border: 'none', background: depositMode === 'other' ? 'var(--primary)' : 'var(--card)', color: depositMode === 'other' ? '#fff' : 'var(--muted-fg)', fontFamily: 'var(--font)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Other Account</button>
            </div>
            {depositMode === 'business' ? (
              <div className="pdp-field">
                <label className="pdp-label">Our Bank Account <span style={{ color: 'var(--destructive)' }}>*</span></label>
                <select className="pdp-select" value={depBank} onChange={(e) => setDepBank(e.target.value)}>
                  <option value="">Select our bank...</option>
                  {banks.map((b) => <option key={b.id} value={b.name}>{b.name}</option>)}
                </select>
              </div>
            ) : (
              <div style={{ background: 'var(--muted)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Destination Account</div>
                <div className="pdp-field" style={{ marginBottom: 8 }}>
                  <label className="pdp-label">Bank Name</label>
                  <input type="text" className="pdp-input" placeholder="e.g. BDO, BPI..." value={depOtherBank} onChange={(e) => setDepOtherBank(e.target.value)} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="pdp-field" style={{ margin: 0 }}><label className="pdp-label">Last 4 Digits</label><input type="text" className="pdp-input" maxLength={4} value={depAccNum} onChange={(e) => setDepAccNum(e.target.value)} /></div>
                  <div className="pdp-field" style={{ margin: 0 }}><label className="pdp-label">Account Name</label><input type="text" className="pdp-input" value={depAccName} onChange={(e) => setDepAccName(e.target.value)} /></div>
                </div>
              </div>
            )}
            <div className="pdp-field"><label className="pdp-label">Amount <span style={{ color: 'var(--destructive)' }}>*</span></label><input type="number" className="pdp-input" min="0" value={depAmount} onChange={(e) => setDepAmount(e.target.value)} /></div>
            <div className="pdp-field"><label className="pdp-label">Reference Number</label><input type="text" className="pdp-input" value={depRef} onChange={(e) => setDepRef(e.target.value)} /></div>
            <div className="pdp-field"><label className="pdp-label">Description</label><input type="text" className="pdp-input" value={depDesc} onChange={(e) => setDepDesc(e.target.value)} /></div>
            <button type="button" className="btn-primary" disabled={depSubmitting} onClick={handleDeposit}>
              <span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>arrow_upward</span> {depSubmitting ? 'Processing...' : 'Deposit'}
            </button>
          </div>
        </div>
      </div>

      <div className={`pay-modal-overlay${transferOpen ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 400 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title"><span className="material-icons-outlined" style={{ verticalAlign: 'middle', marginRight: 6 }}>savings</span>Transfer to Petty Cash</div>
            <button type="button" className="pdp-close-btn" onClick={() => setTransferOpen(false)}><span className="material-icons-outlined">close</span></button>
          </div>
          <div className="pay-modal-body">
            {pettyAccs.length > 1 && (
              <div className="pdp-field">
                <label className="pdp-label">Transfer To <span style={{ color: 'var(--destructive)' }}>*</span></label>
                <select className="pdp-select" value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                  {pettyAccs.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
            )}
            <div className="pdp-field"><label className="pdp-label">Amount <span style={{ color: 'var(--destructive)' }}>*</span></label><input type="number" className="pdp-input" min="0" value={transferAmount} onChange={(e) => setTransferAmount(e.target.value)} /></div>
            <div className="pdp-field"><label className="pdp-label">Description</label><input type="text" className="pdp-input" value={transferDesc} onChange={(e) => setTransferDesc(e.target.value)} /></div>
            <button type="button" className="btn-primary" disabled={transferSubmitting} onClick={handleTransfer}>
              <span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>savings</span> {transferSubmitting ? 'Processing...' : 'Transfer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}