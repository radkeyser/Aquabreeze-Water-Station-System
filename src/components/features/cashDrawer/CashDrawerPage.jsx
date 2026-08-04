import { useEffect, useMemo, useState } from 'react';
import {
  addCashExpense,
  addCashIn,
  deleteCashEntry,
  getCashDrawerData,
  getConfigExpenses,
} from '../../../api/cashDrawer.js';
import RequireShift from '../../../components/features/shift/RequireShift.jsx';
import { formatPeso } from '../../../utils/format.js';
import showToast from '../../../utils/toast.js';
import './cashDrawer.css';

function isProtectedExpense(description) {
  const desc = String(description || '').trim().toLowerCase();
  return (
    desc.startsWith('advance') ||
    desc.startsWith('pautang payment') ||
    desc.startsWith('salary release') ||
    desc.startsWith('inventory')
  );
}

function CashDrawerPageContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [cashData, setCashData] = useState({ transactions: [], startingCash: 0, expectedCash: 0, activeShiftId: '', hasShift: false });
  const [expenses, setExpenses] = useState([]);
  const [addAmount, setAddAmount] = useState('');
  const [addRemarks, setAddRemarks] = useState('');
  const [expenseName, setExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [submittingExpense, setSubmittingExpense] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: '', title: '' });

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [data, configExpenses] = await Promise.all([
          getCashDrawerData(),
          getConfigExpenses(),
        ]);
        if (!mounted) return;
        setCashData(data);
        setExpenses(configExpenses);
      } catch (err) {
        if (!mounted) return;
        setError(err?.message || 'Unable to load cash drawer data.');
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  

  const transactionRows = cashData.transactions || [];
  const addedRows = useMemo(
    () => transactionRows.filter((item) => {
      const type = String(item.type || '').toLowerCase();
      const desc = String(item.description || '').toLowerCase();
      return type === 'in' && desc.startsWith('cash added');
    }),
    [transactionRows]
  );
  const expenseRows = useMemo(
    () => transactionRows.filter((item) => String(item.type || '').toLowerCase() === 'out'),
    [transactionRows]
  );
  const cashSales = useMemo(
    () => transactionRows.reduce((sum, item) => {
      const type = String(item.type || '').toLowerCase();
      const desc = String(item.description || '').toLowerCase();
      if (type === 'in' && !desc.startsWith('cash added')) {
        return sum + (Number(item.amount) || 0);
      }
      return sum;
    }, 0),
    [transactionRows]
  );
  const addedSum = useMemo(() => addedRows.reduce((s, it) => s + (Number(it.amount) || 0), 0), [addedRows]);
  const cashExpenses = useMemo(
    () => expenseRows.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [expenseRows]
  );

  const handleRefresh = async () => {
    setLoading(true);
    setError('');
    try {
      const [data, configExpenses] = await Promise.all([
        getCashDrawerData(),
        getConfigExpenses(),
      ]);
      setCashData(data);
      setExpenses(configExpenses);
    } catch (err) {
      setError(err?.message || 'Unable to refresh cash drawer data.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddCash = async () => {
    const amount = Number(addAmount) || 0;
    if (amount <= 0) {
      showToast('Please enter a valid amount.', { type: 'warn' });
      return;
    }
    setSubmittingAdd(true);
    try {
      await addCashIn({ amount, description: `Cash Added${addRemarks ? ': ' + addRemarks.trim() : ''}` });
      showToast('Cash added!', { type: 'success' });
      setAddAmount('');
      setAddRemarks('');
      await handleRefresh();
    } catch (err) {
      showToast('Error: ' + (err?.message || 'Unable to add cash.'), { type: 'error' });
    } finally {
      setSubmittingAdd(false);
    }
  };

  const handleAddExpense = async () => {
    const amount = Number(expenseAmount) || 0;
    const name = String(expenseName || '').trim();
    if (!name) {
      showToast('Please enter an expense name.', { type: 'warn' });
      return;
    }
    if (amount <= 0) {
      showToast('Please enter a valid expense amount.', { type: 'warn' });
      return;
    }
    setSubmittingExpense(true);
    try {
      await addCashExpense({ amount, description: name });
      showToast('Expense added!', { type: 'success' });
      setExpenseName('');
      setExpenseAmount('');
      await handleRefresh();
    } catch (err) {
      showToast('Error: ' + (err?.message || 'Unable to add expense.'), { type: 'error' });
    } finally {
      setSubmittingExpense(false);
    }
  };

  const handleDeleteEntry = async (id) => {
    if (!id) return;
    setDeletingId(id);
    try {
      await deleteCashEntry(id);
      showToast('Entry deleted.', { type: 'success' });
      await handleRefresh();
    } catch (err) {
      showToast('Error: ' + (err?.message || 'Unable to delete entry.'), { type: 'error' });
    } finally {
      setDeletingId('');
    }
  };

  const openDeleteConfirm = (item) => {
    if (!item) return;
    const remarks = String(item.description || '').replace(/^cash added:?\s*/i, '') || item.description || 'Entry';
    setConfirmDelete({ open: true, id: item.id, title: remarks });
  };

  const closeDeleteConfirm = () => setConfirmDelete({ open: false, id: '', title: '' });

  const confirmDeleteAction = async () => {
    const id = confirmDelete.id;
    if (!id) return closeDeleteConfirm();
    setDeletingId(id);
    try {
      await deleteCashEntry(id);
      showToast('Entry deleted.', { type: 'success' });
      closeDeleteConfirm();
      await handleRefresh();
    } catch (err) {
      showToast('Error: ' + (err?.message || 'Unable to delete entry.'), { type: 'error' });
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="cd-page">
        <div className="cd-header-row">
          {cashData.hasShift ? (
            <div className="cd-status-pill">Shift Open: {cashData.activeShiftId || 'Unknown'}</div>
          ) : (
            <div className="cd-no-shift">No active shift detected. Cash drawer data is scoped to the current open shift.</div>
          )}
        </div>

      {error && <div className="cd-error">{error}</div>}

      <div className="cd-balance-card">
        <div className="cd-balance-label">Cash In Drawer</div>
        <div className="cd-balance-amount">
          {loading ? '—' : formatPeso(cashData.startingCash + addedSum + cashSales - cashExpenses)}
        </div>
      </div>
      {/* Delete confirmation modal */}
      <div className={`pay-modal-overlay${confirmDelete.open ? ' show' : ''}`} id="cdDeleteConfirm">
        <div className="pay-modal" style={{ maxWidth: 420 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title">Confirm Delete</div>
            <button type="button" className="pdp-close-btn" onClick={closeDeleteConfirm}>
              <span className="material-icons-outlined">close</span>
            </button>
          </div>
          <div className="pay-modal-body">
            <div className="pay-modal-info" style={{ padding: '8px 0' }}>
              Are you sure you want to delete "<strong>{confirmDelete.title}</strong>"?
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="button" className="btn-cancel-delete" onClick={closeDeleteConfirm}>Cancel</button>
              <button type="button" className="btn-primary" style={{ flex: 1 }} disabled={deletingId === confirmDelete.id} onClick={confirmDeleteAction}>
                {deletingId === confirmDelete.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="cd-summary-row">
        <div className="cd-mini-card cd-mini-green">
          <div className="cd-mini-label">Starting Cash</div>
          <div className="cd-mini-val">{formatPeso(cashData.startingCash)}</div>
        </div>
        <div className="cd-mini-card cd-mini-orange">
          <div className="cd-mini-label">Cash Added</div>
          <div className="cd-mini-val">{formatPeso(addedRows.reduce((sum, item) => sum + (Number(item.amount) || 0), 0))}</div>
        </div>
        <div className="cd-mini-card cd-mini-red">
          <div className="cd-mini-label">Cash Sales</div>
          <div className="cd-mini-val">{formatPeso(cashSales)}</div>
        </div>
        <div className="cd-mini-card cd-mini-teal">
          <div className="cd-mini-label">Cash Expenses</div>
          <div className="cd-mini-val">{formatPeso(cashExpenses)}</div>
        </div>
      </div>

      <div className="cd-panels-row">
        <div className="cd-panel">
          <div className="cd-panel-header cd-header-orange"><span>Cash Added</span></div>
          <div className="cd-panel-body">
            <div className="cd-input-row">
              <input
                type="number"
                className="pdp-input"
                value={addAmount}
                placeholder="Cash Amount *"
                min="0"
                onChange={(e) => setAddAmount(e.target.value)}
              />
            </div>
            <div className="cd-input-row">
              <input
                type="text"
                className="pdp-input"
                value={addRemarks}
                placeholder="Remarks"
                onChange={(e) => setAddRemarks(e.target.value)}
              />
            </div>
            <div className="cd-panel-actions">
              <button className="btn-primary" type="button" onClick={handleAddCash} disabled={submittingAdd || loading}>
                <span className="material-icons-outlined" style={{ fontSize: 16 }}>
                  {submittingAdd ? 'hourglass_empty' : 'add'}
                </span>
                {submittingAdd ? 'Adding...' : 'Add Cash'}
              </button>
            </div>
            <div className="cd-list">
              {addedRows.length === 0 ? (
                <div className="cd-empty">No entries yet</div>
              ) : (
                addedRows.map((item) => {
                  const remarks = String(item.description || '').replace(/^cash added:?\s*/i, '') || 'Cash Added';
                  return (
                    <div key={item.id || item.date + item.amount} className="cd-list-row">
                      <div className="cd-list-left">
                        <button
                          type="button"
                          className="cd-delete-btn"
                          disabled={deletingId === item.id}
                          onClick={() => openDeleteConfirm(item)}
                        >
                          <span className="material-icons-outlined">delete</span>
                        </button>
                        <div>
                          <div className="cd-list-title">{remarks}</div>
                          <div className="cd-list-date">{item.date}</div>
                        </div>
                      </div>
                      <div className="cd-list-amount">{formatPeso(item.amount)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="cd-panel">
          <div className="cd-panel-header cd-header-teal"><span>Expense Added</span></div>
          <div className="cd-panel-body">
            <div className="cd-input-row" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <datalist id="cdExpenseDatalist">
                {expenses.map((expense) => (
                  <option key={expense} value={expense} />
                ))}
              </datalist>
              <input
                type="text"
                className="pdp-input"
                list="cdExpenseDatalist"
                value={expenseName}
                placeholder="Expense Name *"
                autoComplete="off"
                style={{ flex: 1, minWidth: '180px' }}
                onChange={(e) => setExpenseName(e.target.value)}
              />
              <input
                type="number"
                className="pdp-input"
                value={expenseAmount}
                placeholder="Expense Amount *"
                min="0"
                style={{ flex: 1, minWidth: '180px' }}
                onChange={(e) => setExpenseAmount(e.target.value)}
              />
            </div>
            <div className="cd-panel-actions">
              <button className="btn-primary" type="button" onClick={handleAddExpense} disabled={submittingExpense || loading}>
                <span className="material-icons-outlined" style={{ fontSize: 16 }}>
                  {submittingExpense ? 'hourglass_empty' : 'add'}
                </span>
                {submittingExpense ? 'Adding...' : 'Add Expense'}
              </button>
            </div>
            <div className="cd-list">
              {expenseRows.length === 0 ? (
                <div className="cd-empty">No entries yet</div>
              ) : (
                expenseRows.map((item) => {
                  const protectedItem = isProtectedExpense(item.description);
                  return (
                    <div key={item.id || item.date + item.amount} className="cd-list-row">
                      <div className="cd-list-left">
                        {!protectedItem ? (
                          <button
                            type="button"
                            className="cd-delete-btn"
                            disabled={deletingId === item.id}
                            onClick={() => openDeleteConfirm(item)}
                          >
                            <span className="material-icons-outlined">delete</span>
                          </button>
                        ) : (
                          <div style={{ width: 30, height: 30 }} />
                        )}
                        <div>
                          <div className="cd-list-title">{item.description || 'Expense'}</div>
                          <div className="cd-list-date">{item.date}</div>
                        </div>
                      </div>
                      <div className="cd-list-amount">{formatPeso(item.amount)}</div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CashDrawerPage() {
  return (
    <RequireShift>
      <CashDrawerPageContent />
    </RequireShift>
  );
}