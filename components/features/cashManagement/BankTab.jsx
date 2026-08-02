import { useEffect, useState } from 'react';
import {
  getCashManagementData, addBankAccount, deleteBankAccount,
  cashDeposit, bankWithdraw, bankPayment, bankAddFunds, getPaymentCategories, addPaymentCategory,
} from '../../../src/api/cashManagement.js';
import { formatPeso } from '../../../src/utils/format.js';
import { showToast as notify } from '../../../src/utils/toast.js';
import TransactionTable from './TransactionTable.jsx';

export default function BankTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const showToast = (m) => notify(m);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addAccNum, setAddAccNum] = useState('');
  const [addAccName, setAddAccName] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [modal, setModal] = useState(null);
  const [activeBank, setActiveBank] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [categories, setCategories] = useState([]);
  const [category, setCategory] = useState('');
  const [newCatMode, setNewCatMode] = useState(false);
  const [newCatInput, setNewCatInput] = useState('');
  const [fee, setFee] = useState('0');
  const [destBank, setDestBank] = useState('');
  const [destAccNum, setDestAccNum] = useState('');
  const [destAccName, setDestAccName] = useState('');

  const [source, setSource] = useState('');

  const load = async () => {
    setLoading(true);
    try { setData(await getCashManagementData()); } catch { showToast('Failed to load.'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div style={{ padding: '80px 0', textAlign: 'center' }}><div className="spinner" /></div>;
  if (!data) return <div className="empty-state" style={{ padding: 48 }}>Error loading data.</div>;

  const banks = data.accounts.filter((a) => a.type === 'Bank');
  const txs = data.transactions.filter((t) => ['Deposit', 'Withdraw', 'Payment', 'Add'].includes(t.type));

  async function handleAddBank() {
    if (!addName.trim()) { showToast('Please enter a bank name.'); return; }
    setAddSubmitting(true);
    try {
      const res = await addBankAccount({ name: addName.trim(), accountNumber: addAccNum.trim(), accountName: addAccName.trim() });
      showToast(res.message);
      if (res.success) { setAddOpen(false); setAddName(''); setAddAccNum(''); setAddAccName(''); await load(); }
    } catch (err) { showToast(err?.message || 'Error'); }
    setAddSubmitting(false);
  }

  async function handleDeleteConfirm() {
    setDeleting(true);
    try {
      const res = await deleteBankAccount(deleteTarget);
      showToast(res.message);
      if (res.success) { setDeleteTarget(null); await load(); }
    } catch (err) { showToast(err?.message || 'Error'); }
    setDeleting(false);
  }

  function openModal(bankName, action) {
    setActiveBank(bankName);
    setAmount(''); setReference(''); setDescription('');
    setFee('0'); setDestBank(''); setDestAccNum(''); setDestAccName(''); setSource('');
    setNewCatMode(false); setNewCatInput('');
    if (action === 'payment') {
      setCategory('');
      getPaymentCategories().then(setCategories).catch(() => setCategories([]));
    }
    setModal(action);
  }
  function closeModal() { setModal(null); setActiveBank(''); }

  async function handleSaveCategory() {
    const cat = newCatInput.trim();
    if (!cat) { showToast('Please enter a category name.'); return; }
    if (!categories.includes(cat)) setCategories((prev) => [...prev, cat]);
    setCategory(cat);
    setNewCatMode(false); setNewCatInput('');
    showToast(`Category "${cat}" added!`);
    try { await addPaymentCategory(cat); } catch { /* ignore */ }
  }

  async function handleConfirm() {
    const amt = parseFloat(amount) || 0;
    setSubmitting(true);
    try {
      let res;
      if (modal === 'deposit') {
        if (amt <= 0) { showToast('Please enter an amount.'); setSubmitting(false); return; }
        res = await cashDeposit({ bankAccount: activeBank, amount: amt, reference, description });
      } else if (modal === 'withdraw') {
        if (amt <= 0) { showToast('Please enter an amount.'); setSubmitting(false); return; }
        res = await bankWithdraw({ bankAccount: activeBank, amount: amt, reference, description });
      } else if (modal === 'payment') {
        if (!category) { showToast('Please select a category.'); setSubmitting(false); return; }
        if (amt <= 0) { showToast('Please enter an amount.'); setSubmitting(false); return; }
        if (!destBank.trim()) { showToast('Please enter a destination bank name.'); setSubmitting(false); return; }
        if (!destAccName.trim()) { showToast('Please enter a destination account name.'); setSubmitting(false); return; }
        res = await bankPayment({ bankAccount: activeBank, category, amount: amt, transferFee: parseFloat(fee) || 0, reference, description, destBank: destBank.trim(), destAccNum: destAccNum.trim(), destAccName: destAccName.trim() });
      } else if (modal === 'addfunds') {
        if (!source.trim()) { showToast('Please enter a source.'); setSubmitting(false); return; }
        if (amt <= 0) { showToast('Please enter an amount.'); setSubmitting(false); return; }
        res = await bankAddFunds({ bankAccount: activeBank, source: source.trim(), amount: amt, reference, description });
      }
      showToast(res.message);
      if (res.success) { closeModal(); await load(); }
    } catch (err) { showToast(err?.message || 'Error'); }
    setSubmitting(false);
  }

  const amt = parseFloat(amount) || 0;
  const feeNum = parseFloat(fee) || 0;

  return (
    <div>
      <div className="cash-section-hdr">
        <div className="cash-section-title"><span className="material-icons-outlined">account_balance</span> Bank Accounts</div>
        <button type="button" className="cash-btn-primary" onClick={() => setAddOpen(true)}><span className="material-icons-outlined">add</span> Add Bank</button>
      </div>

      {banks.length === 0 ? (
        <div className="empty-state" style={{ padding: '40px 0' }}>
          <span className="material-icons-outlined" style={{ fontSize: 40, color: 'var(--muted-fg)' }}>account_balance</span>
          <p style={{ color: 'var(--muted-fg)', marginTop: 8 }}>No bank accounts yet.</p>
        </div>
      ) : (
        <div className="cash-bank-cards">
          {banks.map((b) => (
            <div className="cash-bank-card" key={b.id}>
              <div className="cash-bank-card-head">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div className="cash-bank-name">{b.name}</div>
                    {b.accountNumber && <div className="cash-bank-num">****{b.accountNumber}{b.accountName ? ` · ${b.accountName}` : ''}</div>}
                  </div>
                  <button type="button" className="cash-btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setDeleteTarget(b.name)}><span className="material-icons-outlined" style={{ fontSize: 14 }}>delete_outline</span></button>
                </div>
                <div className="cash-bank-bal">{formatPeso(b.balance)}</div>
              </div>
              <div className="cash-bank-actions">
                <button type="button" className="cash-btn-primary" style={{ fontSize: 12, padding: '7px 12px' }} onClick={() => openModal(b.name, 'deposit')}><span className="material-icons-outlined" style={{ fontSize: 14 }}>arrow_downward</span> Deposit</button>
                <button type="button" className="cash-btn-outline" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => openModal(b.name, 'withdraw')}><span className="material-icons-outlined" style={{ fontSize: 14 }}>arrow_upward</span> Withdraw</button>
                <button type="button" className="cash-btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => openModal(b.name, 'payment')}><span className="material-icons-outlined" style={{ fontSize: 14 }}>payment</span> Payment</button>
                <button type="button" className="cash-btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => openModal(b.name, 'addfunds')}><span className="material-icons-outlined" style={{ fontSize: 14 }}>add_circle_outline</span> Add</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="cash-section-hdr" style={{ marginTop: 20 }}><div className="cash-section-title"><span className="material-icons-outlined">receipt_long</span> Bank Transactions</div></div>
      <TransactionTable transactions={txs} showFilters accountOptions={banks.map((b) => b.name)} />

      <div className={`pay-modal-overlay${addOpen ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 420 }}>
          <div className="pay-modal-header"><div className="pay-modal-title">Add Bank Account</div><button type="button" className="pdp-close-btn" onClick={() => setAddOpen(false)}><span className="material-icons-outlined">close</span></button></div>
          <div className="pay-modal-body">
            <div className="pdp-field"><label className="pdp-label">Bank Name <span style={{ color: 'var(--destructive)' }}>*</span></label><input type="text" className="pdp-input" value={addName} onChange={(e) => setAddName(e.target.value)} /></div>
            <div className="pdp-field"><label className="pdp-label">Account Number</label><input type="text" className="pdp-input" value={addAccNum} onChange={(e) => setAddAccNum(e.target.value)} /></div>
            <div className="pdp-field"><label className="pdp-label">Account Name</label><input type="text" className="pdp-input" value={addAccName} onChange={(e) => setAddAccName(e.target.value)} /></div>
            <button type="button" className="btn-primary" disabled={addSubmitting} onClick={handleAddBank}>{addSubmitting ? 'Adding...' : 'Add Bank'}</button>
          </div>
        </div>
      </div>

      <div className={`pay-modal-overlay${deleteTarget ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 360 }}>
          <div className="pay-modal-header"><div className="pay-modal-title">Delete Bank Account</div><button type="button" className="pdp-close-btn" onClick={() => setDeleteTarget(null)}><span className="material-icons-outlined">close</span></button></div>
          <div className="pay-modal-body">
            <div className="pay-modal-info"><div className="pay-modal-customer">{deleteTarget}</div><div className="pay-modal-debt" style={{ color: 'var(--destructive)' }}>This will remove the bank account.</div></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn-cancel-delete" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="btn-primary" style={{ background: 'var(--destructive)', flex: 1 }} disabled={deleting} onClick={handleDeleteConfirm}>{deleting ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      </div>

      <div className={`pay-modal-overlay${modal === 'deposit' ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 420 }}>
          <div className="pay-modal-header"><div className="pay-modal-title">Deposit to {activeBank}</div><button type="button" className="pdp-close-btn" onClick={closeModal}><span className="material-icons-outlined">close</span></button></div>
          <div className="pay-modal-body">
            <div className="pdp-field"><label className="pdp-label">Amount <span style={{ color: 'var(--destructive)' }}>*</span></label><input type="number" className="pdp-input" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="pdp-field"><label className="pdp-label">Reference Number</label><input type="text" className="pdp-input" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
            <div className="pdp-field"><label className="pdp-label">Description</label><input type="text" className="pdp-input" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <button type="button" className="btn-primary" disabled={submitting} onClick={handleConfirm}><span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>arrow_downward</span> {submitting ? 'Processing...' : 'Record Deposit'}</button>
          </div>
        </div>
      </div>

      <div className={`pay-modal-overlay${modal === 'withdraw' ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 400 }}>
          <div className="pay-modal-header"><div className="pay-modal-title">Withdraw from {activeBank}</div><button type="button" className="pdp-close-btn" onClick={closeModal}><span className="material-icons-outlined">close</span></button></div>
          <div className="pay-modal-body">
            <div className="pdp-field"><label className="pdp-label">Amount <span style={{ color: 'var(--destructive)' }}>*</span></label><input type="number" className="pdp-input" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="pdp-field"><label className="pdp-label">Reference Number</label><input type="text" className="pdp-input" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
            <div className="pdp-field"><label className="pdp-label">Description</label><input type="text" className="pdp-input" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <button type="button" className="btn-primary" disabled={submitting} onClick={handleConfirm}><span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>arrow_upward</span> {submitting ? 'Processing...' : 'Withdraw'}</button>
          </div>
        </div>
      </div>

      <div className={`pay-modal-overlay${modal === 'payment' ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 460, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
          <div className="pay-modal-header" style={{ flexShrink: 0 }}><div className="pay-modal-title">{activeBank} — Payment</div><button type="button" className="pdp-close-btn" onClick={closeModal}><span className="material-icons-outlined">close</span></button></div>
          <div className="pay-modal-body" style={{ overflowY: 'auto', flex: 1 }}>
            <div className="pdp-field">
              <label className="pdp-label">Category <span style={{ color: 'var(--destructive)' }}>*</span></label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select className="pdp-select" style={{ flex: 1 }} value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="">Select category...</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <button type="button" className="cash-btn-ghost" style={{ padding: '8px 10px', whiteSpace: 'nowrap' }} onClick={() => setNewCatMode((v) => !v)}><span className="material-icons-outlined" style={{ fontSize: 15 }}>add</span> New</button>
              </div>
              {newCatMode && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  <input type="text" className="pdp-input" placeholder="New category name" style={{ flex: 1 }} value={newCatInput} onChange={(e) => setNewCatInput(e.target.value)} />
                  <button type="button" className="cash-btn-primary" style={{ padding: '8px 12px' }} onClick={handleSaveCategory}>Save</button>
                </div>
              )}
            </div>
            <div style={{ background: 'var(--muted)', borderRadius: 'var(--radius)', padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-fg)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Destination Account <span style={{ color: 'var(--destructive)' }}>*</span></div>
              <div className="pdp-field" style={{ marginBottom: 8 }}><label className="pdp-label">Bank Name <span style={{ color: 'var(--destructive)' }}>*</span></label><input type="text" className="pdp-input" value={destBank} onChange={(e) => setDestBank(e.target.value)} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="pdp-field" style={{ margin: 0 }}><label className="pdp-label">Last 4 Digits</label><input type="text" className="pdp-input" maxLength={4} value={destAccNum} onChange={(e) => setDestAccNum(e.target.value)} /></div>
                <div className="pdp-field" style={{ margin: 0 }}><label className="pdp-label">Account Name <span style={{ color: 'var(--destructive)' }}>*</span></label><input type="text" className="pdp-input" value={destAccName} onChange={(e) => setDestAccName(e.target.value)} /></div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="pdp-field"><label className="pdp-label">Amount <span style={{ color: 'var(--destructive)' }}>*</span></label><input type="number" className="pdp-input" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
              <div className="pdp-field"><label className="pdp-label">Transfer Fee</label><input type="number" className="pdp-input" min="0" value={fee} onChange={(e) => setFee(e.target.value)} /></div>
            </div>
            <div className="pdp-field"><label className="pdp-label">Reference Number</label><input type="text" className="pdp-input" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
            <div className="pdp-field"><label className="pdp-label">Description</label><input type="text" className="pdp-input" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            {amt > 0 && (
              <div className="inv-delivery-price-card" style={{ marginBottom: 14 }}>
                <div className="inv-dpc-row"><span className="inv-dpc-label">Amount</span><span>{formatPeso(amt)}</span></div>
                <div className="inv-dpc-row"><span className="inv-dpc-label">+ Transfer Fee</span><span>{formatPeso(feeNum)}</span></div>
                <div className="inv-dpc-row inv-dpc-total"><span className="inv-dpc-label">Total</span><span className="inv-dpc-total-val">{formatPeso(amt + feeNum)}</span></div>
              </div>
            )}
            <button type="button" className="btn-primary" disabled={submitting} onClick={handleConfirm}><span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>payment</span> {submitting ? 'Processing...' : 'Record Payment'}</button>
          </div>
        </div>
      </div>

      <div className={`pay-modal-overlay${modal === 'addfunds' ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 420 }}>
          <div className="pay-modal-header"><div className="pay-modal-title">Add Funds to {activeBank}</div><button type="button" className="pdp-close-btn" onClick={closeModal}><span className="material-icons-outlined">close</span></button></div>
          <div className="pay-modal-body">
            <div style={{ fontSize: 12, color: 'var(--muted-fg)', marginBottom: 14, padding: '10px 12px', background: 'var(--muted)', borderRadius: 'var(--radius)' }}>Use this to record money deposited into the bank from external sources (other people, outside the business).</div>
            <div className="pdp-field"><label className="pdp-label">Source / From <span style={{ color: 'var(--destructive)' }}>*</span></label><input type="text" className="pdp-input" value={source} onChange={(e) => setSource(e.target.value)} /></div>
            <div className="pdp-field"><label className="pdp-label">Amount <span style={{ color: 'var(--destructive)' }}>*</span></label><input type="number" className="pdp-input" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="pdp-field"><label className="pdp-label">Reference Number</label><input type="text" className="pdp-input" value={reference} onChange={(e) => setReference(e.target.value)} /></div>
            <div className="pdp-field"><label className="pdp-label">Description</label><input type="text" className="pdp-input" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <button type="button" className="btn-primary" disabled={submitting} onClick={handleConfirm}><span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>add_circle_outline</span> {submitting ? 'Processing...' : 'Record Addition'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}