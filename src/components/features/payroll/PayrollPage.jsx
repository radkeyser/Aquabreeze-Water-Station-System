import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { showToast as notify } from '../../../utils/toast.js';
import {
  addAdvance,
  addStaff,
  calcExpected,
  chargeDebtsForStaff,
  clearPayrollRows,
  deleteStaff,
  getChargedDebtsBreakdown,
  getConfigRoles,
  getPayrollData,
  getPautangDebtsForStaff,
  getShiftStatus,
  payPautang,
  releasePay,
  setHoursWorked,
  updatePayroll,
} from '../../../api/payroll.js';
import { formatPeso } from '../../../utils/format.js';
import PayrollHistoryTab from './PayrollHistoryTab.jsx';
import CommissionsTab from './CommissionsTab.jsx';
import './payroll.css';

function Modal({ open, onClose, title, children, maxWidth = 460 }) {
  if (!open) return null;
  return (
    <div
      className="pay-modal-overlay show"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="presentation"
    >
      <div className="pay-modal" style={{ maxWidth, width: '95%' }}>
        <div className="pay-modal-header">
          <div className="pay-modal-title">{title}</div>
          <button type="button" className="pdp-close-btn" onClick={onClose} aria-label="Close">
            <span className="material-icons-outlined">close</span>
          </button>
        </div>
        <div className="pay-modal-body">{children}</div>
      </div>
    </div>
  );
}

function PayStatusPill({ paid, debt }) {
  let cls = 'status-utang';
  let text = 'Enter amount';
  let icon = 'schedule';
  if (paid > 0 && paid < debt) {
    cls = 'status-partial';
    text = `Partial — ${formatPeso(debt - paid)} remaining`;
    icon = 'pie_chart';
  } else if (paid >= debt && paid > 0) {
    cls = 'status-paid';
    text = 'Fully Paid!';
    icon = 'check_circle';
  }
  return (
    <div className={`pdp-status-pill ${cls}`}>
      <span className="material-icons-outlined">{icon}</span>
      <span>{text}</span>
    </div>
  );
}

function DebtDropdown({ dropdown, onClose }) {
  if (!dropdown) return null;
  const { debts, style } = dropdown;
  const total = debts.reduce((s, d) => s + d.amount, 0);

  return createPortal(
    <div className="debt-dropdown" style={style}>
      <div className="debt-dropdown-header">Charged Debts Breakdown</div>
      {debts.length === 0 ? (
        <div style={{ padding: '12px 16px', fontSize: 13, color: 'var(--muted-fg)' }}>
          No charged debts found.
        </div>
      ) : (
        <>
          {debts.map((d) => (
            <div key={d.orderId} className="debt-dropdown-item">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontFamily: 'monospace', fontSize: 11, background: 'var(--muted)',
                  color: 'var(--muted-fg)', padding: '1px 6px', borderRadius: 4,
                }}
                >
                  {d.orderId}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted-fg)' }}>{d.date}</span>
                <span className={`badge ${d.status === 'Partial' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: 11, marginLeft: 'auto' }}>
                  {d.status}
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--destructive)', whiteSpace: 'nowrap' }}>
                  {formatPeso(d.amount)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{d.customerName}</span>
                {d.product && (
                  <>
                    <span style={{ fontSize: 12, color: 'var(--muted-fg)' }}>·</span>
                    <span style={{ fontSize: 12, color: 'var(--muted-fg)' }}>{d.product}</span>
                  </>
                )}
              </div>
            </div>
          ))}
          <div className="debt-dropdown-footer">
            <span style={{ color: 'var(--muted-fg)' }}>Total Charged</span>
            <span style={{ color: 'var(--destructive)' }}>{formatPeso(total)}</span>
          </div>
        </>
      )}
    </div>,
    document.body
  );
}

function MaskedCell({ revealed, children, maskId, valId }) {
  return (
    <>
      <span className="masked-value" id={maskId} style={{ display: revealed ? 'none' : '' }}>••••</span>
      <span id={valId} style={{ display: revealed ? '' : 'none' }}>{children}</span>
    </>
  );
}

export default function PayrollPage() {
  const [activeTab, setActiveTab] = useState('payroll');
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [revealedIds, setRevealedIds] = useState(() => new Set());
  const [massClearMode, setMassClearMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [debtDropdown, setDebtDropdown] = useState(null);
  const debtBtnRef = useRef(null);

  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [editStaffOpen, setEditStaffOpen] = useState(false);
  const [advanceOpen, setAdvanceOpen] = useState(false);
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [massClearConfirmOpen, setMassClearConfirmOpen] = useState(false);
  const [chargeDebtsOpen, setChargeDebtsOpen] = useState(false);
  const [chargeDebtsStep, setChargeDebtsStep] = useState(1);
  const [chargeDebtPayOpen, setChargeDebtPayOpen] = useState(false);
  const [chargeDebtsConfirmOpen, setChargeDebtsConfirmOpen] = useState(false);

  const [addForm, setAddForm] = useState({
    name: '', role: '', rate: '', type: 'Salary-Based',
    commission5Gal: '', commission1000mL: '', commission500mL: '', commissionSlim: '',
  });
  const [editForm, setEditForm] = useState(null);
  const [advanceForm, setAdvanceForm] = useState({ staffId: '', amount: '' });
  const [releasingEmployee, setReleasingEmployee] = useState(null);
  const [deletingEmployee, setDeletingEmployee] = useState(null);

  const [chargingStaffName, setChargingStaffName] = useState('');
  const [chargeDebtsStaffSelect, setChargeDebtsStaffSelect] = useState('');
  const [pendingChargeDebts, setPendingChargeDebts] = useState([]);
  const [chargeDebtsLoading, setChargeDebtsLoading] = useState(false);

  const [cdpOrderId, setCdpOrderId] = useState('');
  const [cdpDebt, setCdpDebt] = useState(0);
  const [cdpCustomer, setCdpCustomer] = useState('');
  const [cdpAmount, setCdpAmount] = useState('');
  const [cdpSubmitting, setCdpSubmitting] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const showToast = useCallback((message, options) => notify(message, options), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [payroll, shift, roleList] = await Promise.all([
        getPayrollData(),
        getShiftStatus(),
        getConfigRoles(),
      ]);
      setEmployees(payroll || []);
      setShiftOpen(!!shift?.isOpen);
      setRoles(roleList || []);
    } catch (err) {
      console.error('Payroll load error', err);
      setError(err?.message || 'Failed to load payroll data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!debtDropdown) return undefined;
    const close = (e) => {
      if (debtBtnRef.current?.contains(e.target)) return;
      if (e.target.closest?.('.debt-dropdown')) return;
      setDebtDropdown(null);
    };
    document.addEventListener('click', close);
    document.addEventListener('scroll', () => setDebtDropdown(null), true);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('scroll', () => setDebtDropdown(null), true);
    };
  }, [debtDropdown]);

  const summary = useMemo(() => {
    const totalPayroll = employees.reduce((s, e) => s + e.expectedSalary, 0);
    const totalDebt = employees.reduce((s, e) => s + e.debtCharge, 0);
    const pending = employees.filter((e) => e.status === 'Pending').length;
    const released = employees.filter((e) => e.status === 'Released').length;
    return { totalPayroll, totalDebt, pending, released };
  }, [employees]);

  const editPreview = useMemo(() => {
    if (!editForm) return 0;
    const isCommission = editForm.type === 'Commission-Based';
    return calcExpected(
      isCommission ? 0 : editForm.rate,
      editForm.days,
      editForm.advance,
      editForm.commission,
      editForm.debtCharge,
      editForm.sssEnabled ? editForm.sss : 0,
      editForm.pagIbigEnabled ? editForm.pagIbig : 0,
      editForm.philHealthEnabled ? editForm.philHealth : 0
    );
  }, [editForm]);

  const chargeDebtsTotal = useMemo(
    () => pendingChargeDebts.reduce((s, d) => s + d.amount, 0),
    [pendingChargeDebts]
  );

  const toggleReveal = (id) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitMassClearMode = () => {
    setMassClearMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = (checked) => {
    if (checked) setSelectedIds(new Set(employees.map((e) => e.id)));
    else setSelectedIds(new Set());
  };

  const toggleSelectRow = (id, checked) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleRpcError = (err, migrationFile) => {
    if (err?.code === 'PGRST202') {
      showToast(`Payroll RPC not set up. Run ${migrationFile} in Supabase SQL Editor.`, { type: 'error' });
    } else {
      showToast(err?.message || 'Something went wrong.', { type: 'error' });
    }
  };

  const refreshEmployee = async (staffId) => {
    const fresh = await getPayrollData();
    setEmployees(fresh);
    return fresh.find((e) => e.id === staffId);
  };

  const handleHoursChange = async (staffId, newHours) => {
    const hours = Math.max(0, parseFloat(newHours) || 0);
    try {
      const result = await setHoursWorked(staffId, hours);
      if (result.success) {
        setEmployees((prev) => prev.map((e) => (
          e.id === staffId
            ? { ...e, daysWorked: result.newDays, expectedSalary: result.expected }
            : e
        )));
      } else {
        showToast(result.message || 'Error updating hours.', { type: 'error' });
      }
    } catch (err) {
      handleRpcError(err, '007_payroll_extended_rpc.sql', { type: 'error' });
    }
  };

  const handleAddStaff = async () => {
    const name = addForm.name.trim();
    const role = addForm.role;
    const isCommission = addForm.type === 'Commission-Based';
    const rate = parseFloat(addForm.rate) || 0;
    if (!name) { showToast('Please enter a name.', { type: 'error' }); return; }
    if (!role) { showToast('Please select a role.', { type: 'error' }); return; }
    if (!isCommission && !rate) { showToast('Please enter hourly rate.', { type: 'error' }); return; }
    setSubmitting(true);
    try {
      const payload = { name, role, type: addForm.type, dailyRate: rate };
      if (isCommission) {
        payload.commission5Gal = parseFloat(addForm.commission5Gal) || 0;
        payload.commission1000mL = parseFloat(addForm.commission1000mL) || 0;
        payload.commission500mL = parseFloat(addForm.commission500mL) || 0;
        payload.commissionSlim = parseFloat(addForm.commissionSlim) || 0;
      }
      const result = await addStaff(payload);
      showToast(result.message, { type: result.success ? 'success' : 'error' });
      if (result.success) {
        setAddStaffOpen(false);
        setAddForm({ name: '', role: '', rate: '', type: 'Salary-Based', commission5Gal: '', commission1000mL: '', commission500mL: '', commissionSlim: '' });
        await loadData();
      }
    } catch (err) {
      handleRpcError(err, '007_payroll_extended_rpc.sql');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (emp) => {
    setEditForm({
      id: emp.id,
      name: emp.name,
      role: emp.role,
      type: emp.type || 'Salary-Based',
      rate: emp.dailyRate,
      days: emp.daysWorked,
      advance: emp.advance,
      commission: emp.commission,
      debtCharge: emp.debtCharge,
      commission5Gal: emp.commission5Gal || '',
      commission1000mL: emp.commission1000mL || '',
      commission500mL: emp.commission500mL || '',
      commissionSlim: emp.commissionSlim || '',
      sssEnabled: emp.sss > 0,
      sss: emp.sss || '',
      pagIbigEnabled: emp.pagibig > 0,
      pagIbig: emp.pagibig || '',
      philHealthEnabled: emp.philhealth > 0,
      philHealth: emp.philhealth || '',
    });
    setEditStaffOpen(true);
  };

  const handleEditStaff = async () => {
    if (!editForm) return;
    const name = editForm.name.trim();
    const isCommission = editForm.type === 'Commission-Based';
    if (!name) { showToast('Please enter a name.', { type: 'error' }); return; }
    if (!editForm.role) { showToast('Please select a role.', { type: 'error' }); return; }
    if (!isCommission && !parseFloat(editForm.rate)) { showToast('Please enter hourly rate.', { type: 'error' }); return; }
    setSubmitting(true);
    try {
      const payload = {
        name,
        role: editForm.role,
        type: editForm.type,
        dailyRate: parseFloat(editForm.rate) || 0,
        daysWorked: parseFloat(editForm.days) || 0,
        advance: parseFloat(editForm.advance) || 0,
        sssEnabled: !!editForm.sssEnabled,
        sss: parseFloat(editForm.sss) || 0,
        pagIbigEnabled: !!editForm.pagIbigEnabled,
        pagIbig: parseFloat(editForm.pagIbig) || 0,
        philHealthEnabled: !!editForm.philHealthEnabled,
        philHealth: parseFloat(editForm.philHealth) || 0,
      };
      if (isCommission) {
        payload.commission5Gal = parseFloat(editForm.commission5Gal) || 0;
        payload.commission1000mL = parseFloat(editForm.commission1000mL) || 0;
        payload.commission500mL = parseFloat(editForm.commission500mL) || 0;
        payload.commissionSlim = parseFloat(editForm.commissionSlim) || 0;
      }
      const result = await updatePayroll(editForm.id, payload);
      showToast(result.message, { type: result.success ? 'success' : 'error' });
      if (result.success) {
        setEditStaffOpen(false);
        setEditForm(null);
        await loadData();
      }
    } catch (err) {
      handleRpcError(err, '007_payroll_extended_rpc.sql');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdvance = async () => {
    const staffId = advanceForm.staffId;
    const amount = parseFloat(advanceForm.amount) || 0;
    if (!staffId) { showToast('Please select a staff member.', { type: 'error' }); return; }
    if (amount <= 0) { showToast('Please enter a valid amount.', { type: 'error' }); return; }
    if (!shiftOpen) { showToast('Please open a shift first.', { type: 'error' }); return; }
    setSubmitting(true);
    try {
      const result = await addAdvance(staffId, amount);
      showToast(result.message, { type: result.success ? 'success' : 'error' });
      if (result.success) {
        setAdvanceOpen(false);
        setAdvanceForm({ staffId: '', amount: '' });
        setEmployees((prev) => prev.map((e) => (
          e.id === staffId
            ? { ...e, advance: result.newAdvance, expectedSalary: result.expected }
            : e
        )));
      }
    } catch (err) {
      handleRpcError(err, '005_payroll_rpc.sql');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRelease = async () => {
    if (!releasingEmployee) return;
    setSubmitting(true);
    try {
      const result = await releasePay(releasingEmployee.id);
      showToast(result.message, { type: result.success ? 'success' : 'error' });
      if (result.success) {
        setReleaseOpen(false);
        setRevealedIds((prev) => {
          const next = new Set(prev);
          next.delete(releasingEmployee.id);
          return next;
        });
        setReleasingEmployee(null);
        await loadData();
      }
    } catch (err) {
      handleRpcError(err, '005_payroll_rpc.sql');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingEmployee) return;
    setSubmitting(true);
    try {
      const result = await deleteStaff(deletingEmployee.id);
      showToast(result.message, { type: result.success ? 'success' : 'error' });
      if (result.success) {
        setDeleteOpen(false);
        setDeletingEmployee(null);
        await loadData();
      }
    } catch (err) {
      handleRpcError(err, '005_payroll_rpc.sql');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMassClear = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    try {
      const result = await clearPayrollRows([...selectedIds]);
      showToast(result.message, { type: result.success ? 'success' : 'error' });
      if (result.success) {
        setMassClearConfirmOpen(false);
        exitMassClearMode();
        await loadData();
      }
    } catch (err) {
      handleRpcError(err, '005_payroll_rpc.sql');
    } finally {
      setSubmitting(false);
    }
  };

  const loadChargeDebts = async () => {
    const staffName = chargeDebtsStaffSelect;
    if (!staffName) { showToast('Please select a staff member.', { type: 'error' }); return; }
    setChargeDebtsLoading(true);
    setChargingStaffName(staffName);
    try {
      const debts = await getPautangDebtsForStaff(staffName);
      setPendingChargeDebts(debts || []);
      setChargeDebtsStep(2);
    } catch (err) {
      showToast(err?.message || 'Failed to load debts.', { type: 'error' });
    } finally {
      setChargeDebtsLoading(false);
    }
  };

  const handleChargeDebts = async () => {
    if (!chargingStaffName) return;
    setSubmitting(true);
    try {
      const result = await chargeDebtsForStaff(chargingStaffName);
      showToast(result.message, { type: result.success ? 'success' : 'error' });
      if (result.success) {
        setChargeDebtsConfirmOpen(false);
        setChargeDebtsOpen(false);
        setChargeDebtsStep(1);
        setPendingChargeDebts([]);
        setChargeDebtsStaffSelect('');
        await loadData();
      }
    } catch (err) {
      handleRpcError(err, '005_payroll_rpc.sql');
    } finally {
      setSubmitting(false);
    }
  };

  const openChargeDebtPay = (orderId, amount, customerName) => {
    setCdpOrderId(orderId);
    setCdpDebt(amount);
    setCdpCustomer(customerName);
    setCdpAmount('');
    setChargeDebtPayOpen(true);
  };

  const handleChargeDebtPay = async () => {
    const amount = parseFloat(cdpAmount) || 0;
    if (amount <= 0) { showToast('Please enter a valid amount.', { type: 'error' }); return; }
    setCdpSubmitting(true);
    try {
      const result = await payPautang(cdpOrderId, amount);
      showToast(result.message, { type: result.success ? 'success' : 'error' });
      if (result.success) {
        setChargeDebtPayOpen(false);
        if (chargingStaffName) await loadChargeDebts();
        await loadData();
      }
    } catch (err) {
      if (err?.code === 'PGRST202') {
        showToast('Pay RPC not set up. Run 003_pautang_rpc.sql in Supabase SQL Editor.', { type: 'error' });
      } else {
        showToast(err?.message || 'Payment failed.', { type: 'error' });
      }
    } finally {
      setCdpSubmitting(false);
    }
  };

  const openDebtDropdown = async (e, emp) => {
    if (debtDropdown?.staffId === emp.id) {
      setDebtDropdown(null);
      return;
    }
    debtBtnRef.current = e.currentTarget;
    const rect = e.currentTarget.getBoundingClientRect();
    setDebtDropdown({
      staffId: emp.id,
      debts: [],
      style: { top: rect.bottom + 6, left: rect.left },
    });
    try {
      const debts = await getChargedDebtsBreakdown(emp.name);
      setDebtDropdown((prev) => {
        if (!prev || prev.staffId !== emp.id) return prev;
        let left = rect.left;
        const width = 300;
        if (left + width > window.innerWidth - 8) left = window.innerWidth - width - 8;
        return { staffId: emp.id, debts: debts || [], style: { top: rect.bottom + 6, left } };
      });
    } catch (err) {
      showToast(err?.message || 'Failed to load debt breakdown.', { type: 'error' });
      setDebtDropdown(null);
    }
  };

  const allSelected = employees.length > 0 && selectedIds.size === employees.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < employees.length;

  if (loading && employees.length === 0) {
    return (
      <div className="page-content" style={{ padding: 24 }}>
        <p style={{ color: 'var(--muted-fg)' }}>Loading payroll…</p>
      </div>
    );
  }

  return (
    <div className="page-content payroll-page">
      <div className="payroll-tab-bar">
        <button type="button" className={`payroll-tab${activeTab === 'payroll' ? ' active' : ''}`} onClick={() => setActiveTab('payroll')}>
          <span className="material-icons-outlined">people</span> Payroll
        </button>
        <button type="button" className={`payroll-tab${activeTab === 'history' ? ' active' : ''}`} onClick={() => setActiveTab('history')}>
          <span className="material-icons-outlined">history</span> History
        </button>
        <button type="button" className={`payroll-tab${activeTab === 'commissions' ? ' active' : ''}`} onClick={() => setActiveTab('commissions')}>
          <span className="material-icons-outlined">percent</span> Commissions
        </button>
      </div>

      {activeTab === 'history' ? (
        <PayrollHistoryTab />
      ) : activeTab === 'commissions' ? (
        <CommissionsTab />
      ) : (
        <>
      {error && (
        <div className="shift-warning-banner" style={{ background: 'var(--destructive-light)', borderColor: 'var(--destructive)', color: 'var(--destructive)' }}>
          <span className="material-icons-outlined">error_outline</span>
          {error}
        </div>
      )}

      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-icon primary"><span className="material-icons-outlined">receipt_long</span></div>
          <div>
            <div className="summary-label">Total Payroll</div>
            <div className="summary-value">{formatPeso(summary.totalPayroll)}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon success"><span className="material-icons-outlined">check_circle</span></div>
          <div>
            <div className="summary-label">Released</div>
            <div className="summary-value">{summary.released}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon danger"><span className="material-icons-outlined">schedule</span></div>
          <div>
            <div className="summary-label">Pending</div>
            <div className="summary-value">{summary.pending}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon danger"><span className="material-icons-outlined">money_off</span></div>
          <div>
            <div className="summary-label">Total Debt Charges</div>
            <div className="summary-value text-danger">{formatPeso(summary.totalDebt)}</div>
          </div>
        </div>
      </div>

      {!shiftOpen && (
        <div className="shift-warning-banner">
          <span className="material-icons-outlined">lock_clock</span>
          No active shift — Advance and Release Pay are disabled until a shift is opened.
        </div>
      )}

      <div className="payroll-header">
        <div className="card-title">
          <span className="material-icons-outlined">people</span>
          <span>Payroll</span>
        </div>
        <div className="payroll-toolbar">
          <button
            type="button"
            className={`btn-mass-clear${massClearMode ? ' active' : ''}`}
            id="massClearToggleBtn"
            onClick={() => (massClearMode ? exitMassClearMode() : setMassClearMode(true))}
          >
            <span className="material-icons-outlined">checklist</span>
            Mass Clear
          </button>
          <button
            type="button"
            className="btn-charge-debts"
            id="chargeDebtsBtn"
            onClick={() => {
              setChargeDebtsStep(1);
              setChargeDebtsStaffSelect('');
              setPendingChargeDebts([]);
              setChargeDebtsOpen(true);
            }}
          >
            <span className="material-icons-outlined">money_off</span>
            Charge Debts
          </button>
          <button
            type="button"
            className="btn-advance"
            id="advanceBtn"
            disabled={!shiftOpen}
            title={shiftOpen ? '' : 'Open a shift first'}
            onClick={() => {
              if (!shiftOpen) { showToast('Please open a shift first.', { type: 'error' }); return; }
              setAdvanceForm({ staffId: '', amount: '' });
              setAdvanceOpen(true);
            }}
          >
            <span className="material-icons-outlined">savings</span>
            Advance
          </button>
          <button type="button" className="btn-add-staff" id="addStaffBtn" onClick={() => { setAddForm({ name: '', role: '', rate: '', type: 'Salary-Based', commission5Gal: '', commission1000mL: '', commission500mL: '', commissionSlim: '' }); setAddStaffOpen(true); }}>
            <span className="material-icons-outlined">person_add</span>
            Add Staff
          </button>
        </div>
      </div>

      {massClearMode && (
        <div className="mass-clear-bar">
          <span className="material-icons-outlined" style={{ fontSize: 18, color: 'var(--destructive)' }}>checklist</span>
          <span className="mass-clear-count-label">{selectedIds.size} selected</span>
          <div className="mass-clear-actions">
            <button
              type="button"
              className="btn-mass-clear-apply"
              disabled={selectedIds.size === 0}
              onClick={() => setMassClearConfirmOpen(true)}
            >
              Clear Selected
            </button>
            <button type="button" className="btn-mass-clear-cancel" onClick={exitMassClearMode}>Cancel</button>
          </div>
        </div>
      )}

      <div className="card payroll-card">
        <div className="card-body payroll-table-wrap">
          <table className={`data-table${massClearMode ? ' payroll-mass-clear' : ''}`} id="payrollTable">
            <thead>
              <tr>
                <th
                  id="payrollCheckboxHeader"
                  className="payroll-col-checkbox payroll-col-sticky"
                  style={{ display: massClearMode ? '' : 'none' }}
                >
                  <input
                    type="checkbox"
                    id="selectAllCheckbox"
                    className="payroll-checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
                </th>
                <th className="payroll-col-name payroll-col-sticky">Name</th>
                <th className="payroll-col-role">Role</th>
                <th className="payroll-col-rate">Hourly Rate</th>
                <th className="payroll-col-days">Hours</th>
                <th className="payroll-col-advance">Advance</th>
                <th className="payroll-col-commission">Commission</th>
                <th>
                  <span title="Uncollected customer debts charged to this staff">
                    Debt Charge
                    {' '}
                    <span className="material-icons-outlined" style={{ fontSize: 13, verticalAlign: 'middle', color: '(var(--muted-fg)' }}>info</span>
                  </span>
                </th>
                <th className="payroll-col-gov">SSS</th>
                <th className="payroll-col-gov">Pag-IBIG</th>
                <th className="payroll-col-gov">PhilHealth</th>
                <th className="payroll-col-expected">Expected</th>
                <th className="payroll-col-status">Status</th>
                <th className="payroll-col-released">Last Released</th>
                <th className="payroll-col-actions">Actions</th>
              </tr>
            </thead>
            <tbody id="payrollTbody">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={15} style={{ textAlign: 'center', padding: 40, color: 'var(--muted-fg)' }}>
                    No staff found
                  </td>
                </tr>
              ) : employees.map((emp, idx) => {
                const rowIndex = idx + 2;
                const revealed = revealedIds.has(emp.id);
                const expColor = emp.expectedSalary < 0
                  ? 'var(--destructive)'
                  : emp.expectedSalary > 0
                    ? 'hsl(150,45%,38%)'
                    : 'var(--primary)';
                return (
                  <tr
                    key={emp.id}
                    data-rowindex={rowIndex}
                    data-id={emp.id}
                    id={`prow-${rowIndex}`}
                    data-revealed={revealed ? '1' : '0'}
                    style={{ position: 'relative' }}
                  >
                    <td className="payroll-checkbox-cell payroll-col-checkbox payroll-col-sticky" style={{ display: massClearMode ? '' : 'none' }}>
                      <input
                        type="checkbox"
                        className="payroll-checkbox row-checkbox"
                        data-rowindex={rowIndex}
                        checked={selectedIds.has(emp.id)}
                        onChange={(e) => toggleSelectRow(emp.id, e.target.checked)}
                      />
                    </td>
                    <td className="text-bold payroll-col-name payroll-col-sticky" data-label="Name">{emp.name}</td>
                    <td className="payroll-col-role" data-label="Role">{emp.role}</td>
                    <td className="payroll-col-rate" id={`rate-cell-${rowIndex}`} data-label="Daily Rate">
                      <MaskedCell revealed={revealed} maskId={`rate-mask-${rowIndex}`} valId={`rate-val-${rowIndex}`}>
                        {formatPeso(emp.dailyRate)}
                      </MaskedCell>
                    </td>
                    <td className="payroll-col-days" data-label="Hours">
                      <input
                        type="number"
                        className="hours-input"
                        id={`days-${rowIndex}`}
                        data-rowindex={rowIndex}
                        defaultValue={emp.daysWorked}
                        min="0"
                        step="any"
                        onBlur={(e) => handleHoursChange(emp.id, e.target.value)}
                      />
                    </td>
                    <td className="text-danger payroll-col-advance" id={`advance-${rowIndex}`} data-label="Advance">{formatPeso(emp.advance)}</td>
                    <td className="payroll-col-commission" id={`commission-cell-${rowIndex}`} data-label="Commission">
                      <MaskedCell revealed={revealed} maskId={`commission-mask-${rowIndex}`} valId={`commission-${rowIndex}`}>
                        {formatPeso(emp.commission)}
                      </MaskedCell>
                    </td>
                    <td className="payroll-col-debt" id={`debtcharge-cell-${rowIndex}`} data-label="Debt Charge">
                      <MaskedCell revealed={revealed} maskId={`debtcharge-mask-${rowIndex}`} valId={`debtcharge-${rowIndex}`}>
                        {emp.debtCharge > 0 ? (
                          <button
                            type="button"
                            className="debt-breakdown-btn"
                            onClick={(e) => openDebtDropdown(e, emp)}
                          >
                            <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {formatPeso(emp.debtCharge)}
                              <span className="material-icons-outlined" style={{ fontSize: 12 }}>expand_more</span>
                            </span>
                          </button>
                        ) : (
                          <span style={{ color: 'var(--muted-fg)' }}>--</span>
                        )}
                      </MaskedCell>
                    </td>
                    <td className="payroll-col-gov" data-label="SSS">
                      <MaskedCell revealed={revealed} maskId={`sss-mask-${rowIndex}`} valId={`sss-${rowIndex}`}>
                        {emp.sss > 0 ? formatPeso(emp.sss) : <span style={{ color: 'var(--muted-fg)' }}>--</span>}
                      </MaskedCell>
                    </td>
                    <td className="payroll-col-gov" data-label="Pag-IBIG">
                      <MaskedCell revealed={revealed} maskId={`pagibig-mask-${rowIndex}`} valId={`pagibig-${rowIndex}`}>
                        {emp.pagibig > 0 ? formatPeso(emp.pagibig) : <span style={{ color: 'var(--muted-fg)' }}>--</span>}
                      </MaskedCell>
                    </td>
                    <td className="payroll-col-gov" data-label="PhilHealth">
                      <MaskedCell revealed={revealed} maskId={`philhealth-mask-${rowIndex}`} valId={`philhealth-${rowIndex}`}>
                        {emp.philhealth > 0 ? formatPeso(emp.philhealth) : <span style={{ color: 'var(--muted-fg)' }}>--</span>}
                      </MaskedCell>
                    </td>
                    <td className="payroll-col-expected" id={`expected-cell-${rowIndex}`} data-label="Expected">
                      <MaskedCell revealed={revealed} maskId={`expected-mask-${rowIndex}`} valId={`expected-${rowIndex}`}>
                        <span className="text-bold" style={{ color: expColor }}>{formatPeso(emp.expectedSalary)}</span>
                      </MaskedCell>
                    </td>
                    <td className="payroll-col-status" data-label="Status">
                      <span className={`badge ${emp.status === 'Released' ? 'badge-success' : 'badge-warning'}`} id={`status-badge-${rowIndex}`}>
                        {emp.status}
                      </span>
                    </td>
                    <td className="payroll-col-released" id={`datereleased-${rowIndex}`} data-label="Last Released">
                      {emp.dateReleased ? (
                        <>
                          <div style={{ fontSize: 12, fontWeight: 600 }}>{emp.dateReleased}</div>
                          {emp.timeReleased && (
                            <div style={{ fontSize: 11, color: 'var(--muted-fg)' }}>{emp.timeReleased}</div>
                          )}
                        </>
                      ) : (
                        <span style={{ color: 'var(--muted-fg)' }}>--</span>
                      )}
                    </td>
                    <td className="payroll-col-actions" data-label="Actions">
                      <div className="payroll-actions">
                        <button
                          type="button"
                          className={`payroll-eye-btn${revealed ? ' revealed' : ''}`}
                          data-rowindex={rowIndex}
                          title="Show/hide amounts"
                          onClick={() => toggleReveal(emp.id)}
                        >
                          <span className="material-icons-outlined">{revealed ? 'visibility_off' : 'visibility'}</span>
                        </button>
                        <button
                          type="button"
                          className="payroll-edit-btn"
                          data-id={emp.id}
                          data-rowindex={rowIndex}
                          data-name={emp.name}
                          data-role={emp.role}
                          data-rate={emp.dailyRate}
                          data-days={emp.daysWorked}
                          data-advance={emp.advance}
                          data-commission={emp.commission}
                          data-debtcharge={emp.debtCharge}
                          onClick={() => openEditModal(emp)}
                        >
                          <span className="material-icons-outlined">edit</span>
                        </button>
                        <button
                          type="button"
                          className="payroll-delete-btn"
                          data-id={emp.id}
                          data-rowindex={rowIndex}
                          data-name={emp.name}
                          onClick={() => { setDeletingEmployee(emp); setDeleteOpen(true); }}
                        >
                          <span className="material-icons-outlined">delete_outline</span>
                        </button>
                        <button
                          type="button"
                          className="payroll-send-btn"
                          data-rowindex={rowIndex}
                          data-name={emp.name}
                          data-expected={emp.expectedSalary}
                          onClick={() => {
                            if (!shiftOpen) { showToast('Please open a shift first.', { type: 'error' }); return; }
                            setReleasingEmployee(emp);
                            setReleaseOpen(true);
                          }}
                        >
                          <span className="material-icons-outlined">send</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="payroll-table-hint">
            <span className="material-icons-outlined">swipe</span>
            Swipe horizontally to see all columns
          </div>
        </div>
      </div>

      <DebtDropdown dropdown={debtDropdown} onClose={() => setDebtDropdown(null)} />

      {/* Add Staff */}
      <Modal open={addStaffOpen} onClose={() => setAddStaffOpen(false)} title="Add New Staff" maxWidth={440}>
        <div className="payroll-modal-scroll">
        <div className="pdp-field">
          <label className="pdp-label" htmlFor="addStaffName">Name</label>
          <input id="addStaffName" className="pdp-input" placeholder="Full name..." value={addForm.name} onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="pdp-field">
          <label className="pdp-label" htmlFor="addStaffRole">Role</label>
          <select id="addStaffRole" className="pdp-select" value={addForm.role} onChange={(e) => setAddForm((f) => ({ ...f, role: e.target.value }))}>
            <option value="">Select role...</option>
            {roles.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="pdp-field">
          <label className="pdp-label" htmlFor="addStaffType">Salary Type</label>
          <select id="addStaffType" className="pdp-select" value={addForm.type} onChange={(e) => setAddForm((f) => ({ ...f, type: e.target.value }))}>
            <option value="Salary-Based">Salary-Based</option>
            <option value="Commission-Based">Commission-Based</option>
          </select>
        </div>
        {addForm.type !== 'Commission-Based' ? (
          <div className="pdp-field">
            <label className="pdp-label" htmlFor="addStaffRate">Hourly Rate</label>
            <input id="addStaffRate" type="number" className="pdp-input" placeholder="0.00" min="0" value={addForm.rate} onChange={(e) => setAddForm((f) => ({ ...f, rate: e.target.value }))} />
          </div>
        ) : (
          <>
            <div className="pdp-field">
              <label className="pdp-label">Commission - 5 Gallon</label>
              <input type="number" className="pdp-input" placeholder="0.00" min="0" value={addForm.commission5Gal} onChange={(e) => setAddForm((f) => ({ ...f, commission5Gal: e.target.value }))} />
            </div>
            <div className="pdp-field">
              <label className="pdp-label">Commission - 1000 mL</label>
              <input type="number" className="pdp-input" placeholder="0.00" min="0" value={addForm.commission1000mL} onChange={(e) => setAddForm((f) => ({ ...f, commission1000mL: e.target.value }))} />
            </div>
            <div className="pdp-field">
              <label className="pdp-label">Commission - 500 mL</label>
              <input type="number" className="pdp-input" placeholder="0.00" min="0" value={addForm.commission500mL} onChange={(e) => setAddForm((f) => ({ ...f, commission500mL: e.target.value }))} />
            </div>
            <div className="pdp-field">
              <label className="pdp-label">Commission - Slim Gallon</label>
              <input type="number" className="pdp-input" placeholder="0.00" min="0" value={addForm.commissionSlim} onChange={(e) => setAddForm((f) => ({ ...f, commissionSlim: e.target.value }))} />
            </div>
          </>
        )}
        </div>
        <button type="button" className="btn-primary" disabled={submitting} onClick={handleAddStaff}>
          {submitting ? 'Adding...' : 'Add Staff'}
        </button>
      </Modal>

      {/* Edit Staff */}
      <Modal open={editStaffOpen && !!editForm} onClose={() => { setEditStaffOpen(false); setEditForm(null); }} title="Edit Staff" maxWidth={500}>
        {editForm && (
          <>
            <div className="payroll-modal-scroll">
            <div className="pdp-field">
              <label className="pdp-label" htmlFor="editStaffType">Salary Type</label>
              <select id="editStaffType" className="pdp-select" value={editForm.type} onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}>
                <option value="Salary-Based">Salary-Based</option>
                <option value="Commission-Based">Commission-Based</option>
              </select>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="pdp-field">
                <label className="pdp-label" htmlFor="editStaffName">Name</label>
                <input id="editStaffName" className="pdp-input" value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="pdp-field">
                <label className="pdp-label" htmlFor="editStaffRole">Role</label>
                <select id="editStaffRole" className="pdp-select" value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}>
                  <option value="">Select role...</option>
                  {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              {editForm.type !== 'Commission-Based' && (
                <div className="pdp-field">
                  <label className="pdp-label" htmlFor="editStaffRate">Hourly Rate</label>
                  <input id="editStaffRate" type="number" className="pdp-input" min="0" value={editForm.rate} onChange={(e) => setEditForm((f) => ({ ...f, rate: e.target.value }))} />
                </div>
              )}
              <div className="pdp-field">
                <label className="pdp-label" htmlFor="editStaffDays">Hours Worked</label>
                <input id="editStaffDays" type="number" className="pdp-input" min="0" value={editForm.days} onChange={(e) => setEditForm((f) => ({ ...f, days: e.target.value }))} />
              </div>
            </div>
            {editForm.type === 'Commission-Based' && (
              <>
                <div className="pdp-field">
                  <label className="pdp-label">Commission - 5 Gallon</label>
                  <input type="number" className="pdp-input" placeholder="0.00" min="0" value={editForm.commission5Gal} onChange={(e) => setEditForm((f) => ({ ...f, commission5Gal: e.target.value }))} />
                </div>
                <div className="pdp-field">
                  <label className="pdp-label">Commission - 1000 mL</label>
                  <input type="number" className="pdp-input" placeholder="0.00" min="0" value={editForm.commission1000mL} onChange={(e) => setEditForm((f) => ({ ...f, commission1000mL: e.target.value }))} />
                </div>
                <div className="pdp-field">
                  <label className="pdp-label">Commission - 500 mL</label>
                  <input type="number" className="pdp-input" placeholder="0.00" min="0" value={editForm.commission500mL} onChange={(e) => setEditForm((f) => ({ ...f, commission500mL: e.target.value }))} />
                </div>
                <div className="pdp-field">
                  <label className="pdp-label">Commission - Slim Gallon</label>
                  <input type="number" className="pdp-input" placeholder="0.00" min="0" value={editForm.commissionSlim} onChange={(e) => setEditForm((f) => ({ ...f, commissionSlim: e.target.value }))} />
                </div>
              </>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 8 }}>
              <div className="pdp-field">
                <label className="pdp-label">
                  <input type="checkbox" checked={!!editForm.sssEnabled} onChange={(e) => setEditForm((f) => ({ ...f, sssEnabled: e.target.checked }))} /> SSS
                </label>
                <input type="number" className="pdp-input" min="0" placeholder="0.00" disabled={!editForm.sssEnabled} value={editForm.sss} onChange={(e) => setEditForm((f) => ({ ...f, sss: e.target.value }))} />
              </div>
              <div className="pdp-field">
                <label className="pdp-label">
                  <input type="checkbox" checked={!!editForm.pagIbigEnabled} onChange={(e) => setEditForm((f) => ({ ...f, pagIbigEnabled: e.target.checked }))} /> Pag-IBIG
                </label>
                <input type="number" className="pdp-input" min="0" placeholder="0.00" disabled={!editForm.pagIbigEnabled} value={editForm.pagIbig} onChange={(e) => setEditForm((f) => ({ ...f, pagIbig: e.target.value }))} />
              </div>
              <div className="pdp-field">
                <label className="pdp-label">
                  <input type="checkbox" checked={!!editForm.philHealthEnabled} onChange={(e) => setEditForm((f) => ({ ...f, philHealthEnabled: e.target.checked }))} /> PhilHealth
                </label>
                <input type="number" className="pdp-input" min="0" placeholder="0.00" disabled={!editForm.philHealthEnabled} value={editForm.philHealth} onChange={(e) => setEditForm((f) => ({ ...f, philHealth: e.target.value }))} />
              </div>
            </div>
            <div className="edit-expected-preview">
              Net Pay:
              {' '}
              <strong style={{ color: editPreview < 0 ? 'var(--destructive)' : editPreview > 0 ? 'hsl(150,45%,38%)' : 'var(--primary)' }}>
                {formatPeso(editPreview)}
              </strong>
            </div>
            </div>
            <button type="button" className="btn-primary" disabled={submitting} onClick={handleEditStaff}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </>
        )}
      </Modal>

      {/* Advance */}
      <Modal open={advanceOpen} onClose={() => setAdvanceOpen(false)} title="Record Advance" maxWidth={420}>
        <div className="pdp-field">
          <label className="pdp-label" htmlFor="advanceStaffSelect">Staff Member</label>
          <select id="advanceStaffSelect" className="pdp-select" value={advanceForm.staffId} onChange={(e) => setAdvanceForm((f) => ({ ...f, staffId: e.target.value }))}>
            <option value="">Select staff...</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
            ))}
          </select>
        </div>
        <div className="pdp-field">
          <label className="pdp-label" htmlFor="advanceAmount">Advance Amount</label>
          <input id="advanceAmount" type="number" className="pdp-input" placeholder="0.00" min="0" value={advanceForm.amount} onChange={(e) => setAdvanceForm((f) => ({ ...f, amount: e.target.value }))} />
        </div>
        <button type="button" className="btn-primary" disabled={submitting} onClick={handleAdvance}>
          {submitting ? 'Recording...' : 'Record Advance'}
        </button>
      </Modal>

      {/* Release */}
      <Modal open={releaseOpen && !!releasingEmployee} onClose={() => { setReleaseOpen(false); setReleasingEmployee(null); }} title="Release Salary" maxWidth={400}>
        {releasingEmployee && (
          <>
            <div className="pay-modal-info">
              <div className="pay-modal-customer" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{releasingEmployee.name}</div>
              <div className="release-amount-preview">
                Amount to release: <strong>{formatPeso(releasingEmployee.expectedSalary)}</strong>
              </div>
              <div className="pay-modal-debt" style={{ marginTop: 6 }}>
                This will record a cash-out, then automatically reset Days, Advance, Commission, Debt Charge and set Status back to Pending.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn-cancel-delete" onClick={() => { setReleaseOpen(false); setReleasingEmployee(null); }}>Cancel</button>
              <button type="button" className="btn-primary" style={{ flex: 1 }} disabled={submitting} onClick={handleRelease}>
                <span className="material-icons-outlined" style={{ fontSize: 17, verticalAlign: 'middle' }}>send</span>
                {' '}
                {submitting ? 'Releasing...' : 'Release Pay'}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Delete */}
      <Modal open={deleteOpen && !!deletingEmployee} onClose={() => { setDeleteOpen(false); setDeletingEmployee(null); }} title="Delete Staff" maxWidth={360}>
        {deletingEmployee && (
          <>
            <div className="pay-modal-info">
              <div className="pay-modal-customer" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{deletingEmployee.name}</div>
              <div className="pay-modal-debt" style={{ color: 'var(--destructive)' }}>
                This will remove the staff from Payroll and Staff sheets, and clear their name from assigned customers.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn-cancel-delete" onClick={() => { setDeleteOpen(false); setDeletingEmployee(null); }}>Cancel</button>
              <button type="button" className="btn-primary" style={{ flex: 1, background: 'var(--destructive)' }} disabled={submitting} onClick={handleDelete}>
                {submitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Mass Clear Confirm */}
      <Modal open={massClearConfirmOpen} onClose={() => setMassClearConfirmOpen(false)} title="Confirm Clear Records" maxWidth={400}>
        <div className="pay-modal-info">
          <div className="pay-modal-customer" style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
            Clear records for {selectedIds.size} staff member{selectedIds.size > 1 ? 's' : ''}?
          </div>
          <div className="pay-modal-debt" style={{ color: 'var(--destructive)' }}>
            This will reset Days Worked, Advance, Commission, Debt Charge, Expected Salary and set Status back to Pending.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn-cancel-delete" onClick={() => setMassClearConfirmOpen(false)}>Cancel</button>
          <button type="button" className="btn-primary" style={{ flex: 1, background: 'var(--destructive)' }} disabled={submitting} onClick={handleMassClear}>
            {submitting ? 'Clearing...' : 'Yes, Clear All'}
          </button>
        </div>
      </Modal>

      {/* Charge Debts */}
      <Modal open={chargeDebtsOpen} onClose={() => setChargeDebtsOpen(false)} title="Charge Debts" maxWidth={500}>
        {chargeDebtsStep === 1 ? (
          <>
            <div className="pdp-field">
              <label className="pdp-label" htmlFor="chargeDebtsStaffSelect">Select Staff Member</label>
              <select id="chargeDebtsStaffSelect" className="pdp-select" value={chargeDebtsStaffSelect} onChange={(e) => setChargeDebtsStaffSelect(e.target.value)}>
                <option value="">Choose staff...</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.name}>{e.name} ({e.role})</option>
                ))}
              </select>
            </div>
            <button type="button" className="btn-primary" disabled={chargeDebtsLoading} onClick={loadChargeDebts}>
              <span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>
                {chargeDebtsLoading ? 'hourglass_empty' : 'search'}
              </span>
              {' '}
              {chargeDebtsLoading ? 'Loading...' : 'View Debts'}
            </button>
          </>
        ) : (
          <>
            <div className="charge-debts-step-header">
              <button
                type="button"
                className="charge-debts-back-btn"
                onClick={() => { setChargeDebtsStep(1); setChargeDebtsOpen(true); }}
              >
                <span className="material-icons-outlined" style={{ fontSize: 18 }}>arrow_back</span>
              </button>
              <div style={{ fontSize: 15, fontWeight: 700 }}>{chargingStaffName}</div>
              <div className="pautang-row-count" style={{ marginLeft: 'auto' }}>
                {pendingChargeDebts.length} debt{pendingChargeDebts.length !== 1 ? 's' : ''}
              </div>
            </div>
            <div className="charge-debts-debt-list">
              {pendingChargeDebts.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--muted-fg)', fontSize: 13 }}>
                  No uncharged debts found for {chargingStaffName}.
                </div>
              ) : pendingChargeDebts.map((d) => (
                <div key={d.orderId} className="payroll-charge-debt-item">
                  <div className="payroll-charge-debt-row">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700 }}>{d.customerName}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted-fg)' }}>{d.orderId} · {d.date}</div>
                    </div>
                    <span className={`badge ${d.status === 'Partial' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: 11 }}>{d.status}</span>
                    <span style={{ fontWeight: 800, color: 'var(--destructive)', whiteSpace: 'nowrap' }}>{formatPeso(d.amount)}</span>
                  </div>
                  <div className="payroll-charge-debt-row2">
                    {d.product ? (
                      <span style={{ fontSize: 12, color: 'var(--muted-fg)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span className="material-icons-outlined" style={{ fontSize: 13 }}>shopping_bag</span>
                        {d.product}
                      </span>
                    ) : <span />}
                    <button
                      type="button"
                      className="pay-btn"
                      style={{ padding: '4px 10px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      onClick={() => openChargeDebtPay(d.orderId, d.amount, d.customerName)}
                    >
                      <span className="material-icons-outlined" style={{ fontSize: 14 }}>payments</span>
                      Pay
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="pay-modal-info" style={{ marginBottom: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'var(--muted-fg)' }}>Total to Charge</span>
                <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--destructive)' }}>{formatPeso(chargeDebtsTotal)}</span>
              </div>
            </div>
            <button
              type="button"
              className="btn-primary"
              style={{ background: 'var(--destructive)' }}
              disabled={pendingChargeDebts.length === 0}
              onClick={() => setChargeDebtsConfirmOpen(true)}
            >
              <span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>money_off</span>
              {' '}
              Charge to {chargingStaffName}
            </button>
          </>
        )}
      </Modal>

      {/* Charge Debts Confirm */}
      <Modal open={chargeDebtsConfirmOpen} onClose={() => setChargeDebtsConfirmOpen(false)} title="Confirm Charge" maxWidth={400}>
        <div className="pay-modal-info">
          <div className="pay-modal-customer" style={{ fontSize: 15, fontWeight: 700 }}>
            Charge {pendingChargeDebts.length} debt(s) to {chargingStaffName}?
          </div>
          <div className="pay-modal-debt" style={{ marginTop: 6 }}>
            Total: <strong style={{ color: 'var(--destructive)' }}>{formatPeso(chargeDebtsTotal)}</strong>
          </div>
          <div className="pay-modal-debt" style={{ marginTop: 4, color: 'var(--muted-fg)' }}>
            This will mark these debts as charged and add the total to their Debt Charge column.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn-cancel-delete" onClick={() => setChargeDebtsConfirmOpen(false)}>Cancel</button>
          <button type="button" className="btn-primary" style={{ flex: 1, background: 'var(--destructive)' }} disabled={submitting} onClick={handleChargeDebts}>
            <span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>money_off</span>
            {' '}
            {submitting ? 'Charging...' : 'Yes, Charge Now'}
          </button>
        </div>
      </Modal>

      </>
      )}

      {/* Charge Debt Pay */}
      <Modal open={chargeDebtPayOpen} onClose={() => setChargeDebtPayOpen(false)} title="Record Payment">
        <div className="pay-modal-info">
          <div className="pay-modal-customer" style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
            {cdpCustomer}  {cdpOrderId}
          </div>
          <div className="pay-modal-debt">
            Outstanding: <strong style={{ color: 'var(--destructive)' }}>{formatPeso(cdpDebt)}</strong>
          </div>
        </div>
        <div className="pdp-field">
          <label className="pdp-label" htmlFor="chargeDebtPayAmount">Amount Paid</label>
          <div className="pdp-amount-row">
            <input
              id="chargeDebtPayAmount"
              type="number"
              className="pdp-input"
              placeholder="0.00"
              min="0"
              max={cdpDebt}
              value={cdpAmount}
              onChange={(e) => {
                const v = parseFloat(e.target.value) || 0;
                setCdpAmount(v > cdpDebt ? String(cdpDebt) : e.target.value);
              }}
            />
            <button type="button" className="btn-exact" onClick={() => setCdpAmount(String(cdpDebt))}>Exact</button>
          </div>
        </div>
        <PayStatusPill paid={parseFloat(cdpAmount) || 0} debt={cdpDebt} />
        <button type="button" className="btn-primary" disabled={cdpSubmitting} onClick={handleChargeDebtPay}>
          {cdpSubmitting ? 'Processing...' : 'Confirm Payment'}
        </button>
      </Modal>

    </div>
  );
}
