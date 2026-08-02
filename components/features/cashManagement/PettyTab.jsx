import { useEffect, useState } from 'react';
import { getCashManagementData, addPettyCashAccount, deletePettyCashAccount, cashTransfer, pettyCashOut } from '../../../src/api/cashManagement.js';
import { formatPeso } from '../../../src/utils/format.js';
import { showToast as notify } from '../../../src/utils/toast.js';
import TransactionTable from './TransactionTable.jsx';

export default function PettyTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const showToast = (m) => notify(m);

  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);

  const [modal, setModal] = useState(null);
  const [activeAcct, setActiveAcct] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try { setData(await getCashManagementData()); } catch { showToast('Failed to load.'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  if (loading) return <div style={{ padding: '80px 0', textAlign: 'center' }}><div className="spinner" /></div>;
  if (!data) return <div className="empty-state" style={{ padding: 48 }}>Error loading data.</div>;

  const pettyAccs = data.accounts.filter((a) => a.type === 'PettyCash');
  const totalPetty = pettyAccs.reduce((s, a) => s + a.balance, 0);
  const txs = data.transactions.filter((t) => pettyAccs.some((a) => t.from === a.name || t.to === a.name));

  async function handleAdd() {
    if (!addName.trim()) { showToast('Please enter an account name.'); return; }
    setAddSubmitting(true);
    try {
      const res = await addPettyCashAccount({ name: addName.trim() });
      showToast(res.message);
      if (res.success) { setAddOpen(false); setAddName(''); await load(); }
    } catch (err) { showToast(err?.message || 'Error'); }
    setAddSubmitting(false);
  }

  async function handleDelete() {
    try {
      const res = await deletePettyCashAccount(deleteTarget);
      showToast(res.message);
      if (res.success) { setDeleteTarget(null); await load(); }
    } catch (err) { showToast(err?.message || 'Error'); }
  }

  function openModal(acctName, action) {
    setActiveAcct(acctName); setAmount(''); setDescription(''); setModal(action);
  }
  function closeModal() { setModal(null); setActiveAcct(''); }

  async function handleConfirm() {
    const amt = parseFloat(amount) || 0;
    if (amt <= 0) { showToast('Please enter an amount.'); return; }
    if (modal === 'cashout' && !description.trim()) { showToast('Please enter a description.'); return; }
    setSubmitting(true);
    try {
      let res;
      if (modal === 'add') res = await cashTransfer({ from: 'Cash', to: activeAcct, amount: amt, description: description.trim() || `Add to ${activeAcct}` });
      else if (modal === 'return') res = await cashTransfer({ from: activeAcct, to: 'Cash', amount: amt, description: description.trim() || 'Return to Cash' });
      else if (modal === 'cashout') res = await pettyCashOut({ fromAccount: activeAcct, amount: amt, description: description.trim() });
      showToast(res.message);
      if (res.success) { closeModal(); await load(); }
    } catch (err) { showToast(err?.message || 'Error'); }
    setSubmitting(false);
  }

  return (
    <div>
      <div className="cash-section-hdr">
        <div>
          <div className="cash-section-title"><span className="material-icons-outlined">savings</span> Petty Cash Accounts</div>
          <div className="cash-section-sub">Total: {formatPeso(totalPetty)}</div>
        </div>
        <button type="button" className="cash-btn-primary" onClick={() => setAddOpen(true)}><span className="material-icons-outlined">add</span> Add Account</button>
      </div>

      <div className="cash-bank-cards">
        {pettyAccs.map((pc) => (
          <div className="cash-bank-card" key={pc.id}>
            <div className="cash-bank-card-head">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div><div className="cash-bank-name">{pc.name}</div><div className="cash-bank-bal">{formatPeso(pc.balance)}</div></div>
                {pc.name !== 'Petty Cash' && (
                  <button type="button" className="cash-btn-ghost" style={{ padding: '4px 8px' }} onClick={() => setDeleteTarget(pc.name)}><span className="material-icons-outlined" style={{ fontSize: 14 }}>delete_outline</span></button>
                )}
              </div>
            </div>
            <div className="cash-bank-actions">
              <button type="button" className="cash-btn-primary" style={{ fontSize: 12, padding: '7px 12px' }} onClick={() => openModal(pc.name, 'add')}><span className="material-icons-outlined" style={{ fontSize: 14 }}>add</span> Add Cash</button>
              <button type="button" className="cash-btn-outline" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => openModal(pc.name, 'return')}><span className="material-icons-outlined" style={{ fontSize: 14 }}>swap_horiz</span> Return</button>
              <button type="button" className="cash-btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={() => openModal(pc.name, 'cashout')}><span className="material-icons-outlined" style={{ fontSize: 14 }}>remove_circle_outline</span> Cash Out</button>
            </div>
          </div>
        ))}
      </div>

      <div className="cash-section-hdr" style={{ marginTop: 20 }}><div className="cash-section-title"><span className="material-icons-outlined">history</span> Petty Cash Transactions</div></div>
      <TransactionTable transactions={txs} showFilters accountOptions={pettyAccs.map((a) => a.name)} />

      <div className={`pay-modal-overlay${addOpen ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 380 }}>
          <div className="pay-modal-header"><div className="pay-modal-title">Add Petty Cash Account</div><button type="button" className="pdp-close-btn" onClick={() => setAddOpen(false)}><span className="material-icons-outlined">close</span></button></div>
          <div className="pay-modal-body">
            <div className="pdp-field"><label className="pdp-label">Account Name <span style={{ color: 'var(--destructive)' }}>*</span></label><input type="text" className="pdp-input" placeholder="e.g. PC - Bahay" value={addName} onChange={(e) => setAddName(e.target.value)} /></div>
            <button type="button" className="btn-primary" disabled={addSubmitting} onClick={handleAdd}>{addSubmitting ? 'Adding...' : 'Add Account'}</button>
          </div>
        </div>
      </div>

      <div className={`pay-modal-overlay${modal ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 380 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title">{modal === 'add' ? `Add Cash to ${activeAcct}` : modal === 'return' ? `Return from ${activeAcct}` : `Cash Out from ${activeAcct}`}</div>
            <button type="button" className="pdp-close-btn" onClick={closeModal}><span className="material-icons-outlined">close</span></button>
          </div>
          <div className="pay-modal-body">
            {modal === 'cashout' && (
              <div style={{ fontSize: 12, color: 'var(--muted-fg)', marginBottom: 14, padding: '10px 12px', background: 'var(--muted)', borderRadius: 'var(--radius)' }}>Record money taken out of this petty cash account for expenses or other purposes.</div>
            )}
            <div className="pdp-field"><label className="pdp-label">Amount <span style={{ color: 'var(--destructive)' }}>*</span></label><input type="number" className="pdp-input" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="pdp-field"><label className="pdp-label">Description{modal === 'cashout' && <span style={{ color: 'var(--destructive)' }}> *</span>}</label><input type="text" className="pdp-input" placeholder={modal === 'cashout' ? 'e.g. Office supplies, Fare...' : 'Optional'} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <button type="button" className="btn-primary" style={modal === 'cashout' ? { background: 'var(--destructive)' } : {}} disabled={submitting} onClick={handleConfirm}>
              {modal === 'add' && <><span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>add</span> {submitting ? 'Adding...' : 'Add'}</>}
              {modal === 'return' && (submitting ? 'Processing...' : 'Return')}
              {modal === 'cashout' && <><span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>remove_circle_outline</span> {submitting ? 'Processing...' : 'Cash Out'}</>}
            </button>
          </div>
        </div>
      </div>

      <div className={`pay-modal-overlay${deleteTarget ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 360 }}>
          <div className="pay-modal-header"><div className="pay-modal-title">Delete Petty Cash Account</div><button type="button" className="pdp-close-btn" onClick={() => setDeleteTarget(null)}><span className="material-icons-outlined">close</span></button></div>
          <div className="pay-modal-body">
            <div className="pay-modal-info"><div className="pay-modal-customer">{deleteTarget}</div><div className="pay-modal-debt" style={{ color: 'var(--destructive)' }}>This cannot be undone.</div></div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn-cancel-delete" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className="btn-primary" style={{ background: 'var(--destructive)', flex: 1 }} onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}