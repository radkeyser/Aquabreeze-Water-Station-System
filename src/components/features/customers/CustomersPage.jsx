import { useCallback, useEffect, useMemo, useState } from 'react';
import { showToast as notify } from '../../../utils/toast.js';
import CustomerTableRow from './CustomerTableRow.jsx';
import {
  addCustomer,
  deleteCustomer,
  getCustomerBorrows,
  getCustomerOrders,
  getCustomers,
  getDefaultProductPrices,
  getDeliveryBoys,
  getShiftStatus,
  getStaff,
  payPautang,
  processReturn,
  updateCustomer,
} from '../../../api/customers.js';
import { formatPeso } from '../../../utils/format.js';
import './customers.css';
import '../../../index.css';

const SORT_COLS = ['name', 'location', 'pointPerson', 'gallonSlim', 'gallonPoly', 'dispenser', 'utang', 'status'];
const COL_LABELS = { pointPerson: 'Point Person', gallonSlim: 'Slim Gallon', gallonPoly: 'Poly Gallon' };

function customerPayload(c) {
  return {
    name: c.name,
    location: c.location || '',
    pointPerson: c.pointPerson || '',
    overrideOn: !!c.overrideOn,
    override5gal: Number(c.override5gal) || 0,
    override500: Number(c.override500) || 0,
    override1000: Number(c.override1000) || 0,
  };
}

function OverridePricesFields({ prefix, values, onChange }) {
  return (
    <div className="override-prices-grid">
      {[
        { key: 'override5gal', label: '5 Gallon Price' },
        { key: 'override500', label: '500mL Price' },
        { key: 'override1000', label: '1000mL Price' },
      ].map(({ key, label }) => (
        <div key={key} className="pdp-field">
          <label className="pdp-label">{label}</label>
          <div className="pdp-input-with-icon">
            <span>₱</span>
            <input
              type="number"
              className="pdp-input"
              id={`${prefix}${key}`}
              placeholder="0.00"
              min="0"
              step="0.01"
              value={values[key] ?? ''}
              onChange={(e) => onChange(key, e.target.value)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [staff, setStaff] = useState([]);
  const [deliveryBoys, setDeliveryBoys] = useState([]);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [defaultPrices, setDefaultPrices] = useState({ gal5: 0, ml500: 0, ml1000: 0 });
  const [loading, setLoading] = useState(true);

  const [searchQ, setSearchQ] = useState('');
  const [ppFilter, setPpFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [massEditMode, setMassEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [massEditPP, setMassEditPP] = useState('');
  const [inlineSaving, setInlineSaving] = useState(null);

  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [overrideConfirmOpen, setOverrideConfirmOpen] = useState(false);
  const [viewOverrideOpen, setViewOverrideOpen] = useState(false);
  const [massConfirmOpen, setMassConfirmOpen] = useState(false);
  const [ordersOpen, setOrdersOpen] = useState(false);
  const [borrowOpen, setBorrowOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [borrowReturnMode, setBorrowReturnMode] = useState(false);

  const [activeCustomer, setActiveCustomer] = useState(null);
  const [form, setForm] = useState({});
  const [pendingAdd, setPendingAdd] = useState(null);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [borrowData, setBorrowData] = useState(null);
  const [borrowLoading, setBorrowLoading] = useState(false);
  const [returnAmounts, setReturnAmounts] = useState({});
  const [returnDispenser, setReturnDispenser] = useState(0);
  const [payOrderId, setPayOrderId] = useState(null);
  const [payDebt, setPayDebt] = useState(0);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [submitting, setSubmitting] = useState(false);

  const showToast = useCallback((msg) => notify(msg), []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [custs, stf, boys, shift, prices] = await Promise.all([
        getCustomers(),
        getStaff(),
        getDeliveryBoys(),
        getShiftStatus(),
        getDefaultProductPrices(),
      ]);
      setCustomers(custs);
      setStaff(stf);
      setDeliveryBoys(boys);
      setShiftOpen(!!shift?.isOpen);
      setDefaultPrices(prices);
    } catch (err) {
      showToast(err?.message || 'Failed to load customers.', { type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { reload(); }, [reload]);

  const filtered = useMemo(() => {
    const q = searchQ.trim().toLowerCase();
    const pp = ppFilter.toLowerCase();
    let list = customers.filter((c) => {
      const matchQ = !q
        || c.name.toLowerCase().includes(q)
        || (c.location || '').toLowerCase().includes(q)
        || (c.pointPerson || '').toLowerCase().includes(q);
      const matchPP = !pp || (c.pointPerson || '').toLowerCase() === pp;
      const matchStatus = !statusFilter
        || (statusFilter === 'active' ? c.isActive : !c.isActive);
      return matchQ && matchPP && matchStatus;
    });
    if (sortCol) {
      list = [...list].sort((a, b) => {
        const va = sortCol === 'status' ? (a.isActive ? 1 : 0) : a[sortCol];
        const vb = sortCol === 'status' ? (b.isActive ? 1 : 0) : b[sortCol];
        if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sortDir;
        return String(va || '').localeCompare(String(vb || '')) * sortDir;
      });
    }
    return list;
  }, [customers, searchQ, ppFilter, statusFilter, sortCol, sortDir]);

  const isFiltering = !!(searchQ.trim() || ppFilter || statusFilter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => { setPage(1); }, [searchQ, ppFilter, statusFilter, sortCol, sortDir, pageSize]);

  function toggleSort(col) {
    if (sortCol === col) setSortDir((d) => d * -1);
    else { setSortCol(col); setSortDir(1); }
  }

  function sortIcon(col) {
    if (sortCol !== col) return '↕';
    return sortDir === 1 ? '↑' : '↓';
  }

  function getPageNumbers(current, total) {
    const pages = [];
    const windowSize = 1;
    const range = new Set([1, total, current]);
    for (let i = 1; i <= windowSize; i++) {
      range.add(current - i);
      range.add(current + i);
    }
    const sorted = [...range].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
    let prev = 0;
    for (const n of sorted) {
      if (prev && n - prev > 1) pages.push('…');
      pages.push(n);
      prev = n;
    }
    return pages;
  }

  function exitMassEdit() {
    setMassEditMode(false);
    setSelectedIds(new Set());
    setMassEditPP('');
  }

  const selectedList = useMemo(
    () => customers.filter((c) => selectedIds.has(c.id)),
    [customers, selectedIds]
  );

  const massEditMixed = useMemo(() => {
    if (!selectedList.length) return false;
    const first = selectedList[0].pointPerson || '';
    return !selectedList.every((c) => (c.pointPerson || '') === first);
  }, [selectedList]);

  function toggleSelectAll(checked) {
    if (checked) setSelectedIds(new Set(pageData.map((c) => c.id)));
    else setSelectedIds(new Set());
  }

  async function handleInlinePP(customer, newPP, selectEl) {
    const prev = customer.pointPerson || '';
    if (newPP === prev) return;
    setInlineSaving(customer.id);
    try {
      const result = await updateCustomer(customer.id, customerPayload({ ...customer, pointPerson: newPP }));
      if (result?.success === false) throw new Error(result.message);
      showToast('Point person updated!', { type: 'success' });
      await reload();
    } catch (err) {
      showToast(err?.message || 'Update failed.', { type: 'error' });
      if (selectEl) selectEl.value = prev;
    } finally {
      setInlineSaving(null);
    }
  }

  function openAdd() {
    setForm({
      name: '', location: '', pointPerson: '',
      overrideOn: false,
      override5gal: '', override500: '', override1000: '',
    });
    setAddOpen(true);
  }

  function openEdit(customer) {
    setActiveCustomer(customer);
    setForm({
      name: customer.name,
      location: customer.location || '',
      pointPerson: customer.pointPerson || '',
      overrideOn: customer.overrideOn,
      override5gal: customer.override5gal || '',
      override500: customer.override500 || '',
      override1000: customer.override1000 || '',
    });
    setEditOpen(true);
  }

  function fillDefaultPrices(formState, setFn) {
    setFn({
      ...formState,
      override5gal: formState.override5gal || defaultPrices.gal5 || '',
      override500: formState.override500 || defaultPrices.ml500 || '',
      override1000: formState.override1000 || defaultPrices.ml1000 || '',
    });
  }

  async function saveAdd(skipConfirm = false) {
    const name = String(form.name || '').trim();
    if (!name) { showToast('Please enter a customer name.', { type: 'error' }); return; }
    const payload = {
      name,
      location: String(form.location || '').trim(),
      pointPerson: form.pointPerson || '',
      overrideOn: !!form.overrideOn,
      override5gal: form.overrideOn ? Number(form.override5gal) || 0 : 0,
      override500: form.overrideOn ? Number(form.override500) || 0 : 0,
      override1000: form.overrideOn ? Number(form.override1000) || 0 : 0,
    };
    if (payload.overrideOn && !skipConfirm) {
      setPendingAdd(payload);
      setOverrideConfirmOpen(true);
      return;
    }
    setSubmitting(true);
    try {
      const result = await addCustomer(payload);
      if (result?.success === false) throw new Error(result.message);
      showToast(result?.message || 'Customer added!', { type: 'success' });
      setAddOpen(false);
      setOverrideConfirmOpen(false);
      setPendingAdd(null);
      await reload();
    } catch (err) {
      if (err?.code === 'PGRST202') showToast('Run 004_customers_rpc.sql in Supabase SQL Editor.', { type: 'error' });
      else showToast(err?.message || 'Failed to add customer.', { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit() {
    if (!activeCustomer) return;
    const name = String(form.name || '').trim();
    if (!name) { showToast('Please enter a customer name.', { type: 'error' }); return; }
    setSubmitting(true);
    try {
      const result = await updateCustomer(activeCustomer.id, {
        name,
        location: String(form.location || '').trim(),
        pointPerson: form.pointPerson || '',
        overrideOn: !!form.overrideOn,
        override5gal: form.overrideOn ? Number(form.override5gal) || 0 : 0,
        override500: form.overrideOn ? Number(form.override500) || 0 : 0,
        override1000: form.overrideOn ? Number(form.override1000) || 0 : 0,
      });
      if (result?.success === false) throw new Error(result.message);
      showToast(result?.message || 'Customer updated!', { type: 'success' });
      setEditOpen(false);
      await reload();
    } catch (err) {
      showToast(err?.message || 'Update failed.', { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!activeCustomer) return;
    setSubmitting(true);
    try {
      const result = await deleteCustomer(activeCustomer.id);
      if (result?.success === false) throw new Error(result.message);
      showToast(result?.message || 'Customer deleted.', { type: 'success' });
      setDeleteOpen(false);
      await reload();
    } catch (err) {
      showToast(err?.message || 'Delete failed.', { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  async function applyMassEdit() {
    if (!massEditPP || !selectedList.length) return;
    setSubmitting(true);
    let hasError = false;
    for (const c of selectedList) {
      try {
        const result = await updateCustomer(c.id, customerPayload({ ...c, pointPerson: massEditPP }));
        if (result?.success === false) hasError = true;
      } catch {
        hasError = true;
      }
    }
    setSubmitting(false);
    setMassConfirmOpen(false);
    showToast(hasError ? 'Some updates failed.' : 'Point persons updated!', { type: 'success' });
    exitMassEdit();
    await reload();
  }

  async function openOrdersModal(customer) {
    setActiveCustomer(customer);
    setOrdersOpen(true);
    setOrdersLoading(true);
    try {
      const data = await getCustomerOrders(customer.name, customer.id);
      setOrders(data);
    } catch {
      setOrders([]);
      showToast('Failed to load orders.', { type: 'error' });
    } finally {
      setOrdersLoading(false);
    }
  }

  async function openBorrowModal(customer) {
    setActiveCustomer(customer);
    setBorrowReturnMode(false);
    setBorrowOpen(true);
    setBorrowLoading(true);
    try {
      const data = await getCustomerBorrows(customer.id);
      setBorrowData(data);
    } catch {
      setBorrowData(null);
      showToast('Failed to load borrow history.', { type: 'error' });
    } finally {
      setBorrowLoading(false);
    }
  }

  function openReturnForm() {
    const initial = {};
    (borrowData?.gallonBuckets || []).forEach((b) => { initial[b.type] = 0; });
    setReturnAmounts(initial);
    setReturnDispenser(0);
    setBorrowReturnMode(true);
  }

  async function confirmReturn() {
    if (!activeCustomer) return;
    const bucketEntries = Object.entries(returnAmounts).filter(([, v]) => v > 0);
    if (!bucketEntries.length && returnDispenser <= 0) {
      showToast('Please enter a return quantity of at least 1.', { type: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      // Each gallon type is its own transaction — a Slim return and a Poly
      // return are conceptually separate borrowed-row events, not one row.
      for (const [gallonType, amount] of bucketEntries) {
        const result = await processReturn({
          customerId: activeCustomer.id,
          customerName: activeCustomer.name,
          returnGallon: amount,
          returnDispenser: 0,
          gallonType: gallonType === 'Unknown' ? '' : gallonType,
        });
        if (result?.success === false) throw new Error(result.message);
      }
      if (returnDispenser > 0) {
        const result = await processReturn({
          customerId: activeCustomer.id,
          customerName: activeCustomer.name,
          returnGallon: 0,
          returnDispenser,
        });
        if (result?.success === false) throw new Error(result.message);
      }
      showToast('Return recorded!', { type: 'success' });
      setBorrowOpen(false);
      await reload();
    } catch (err) {
      showToast(err?.message || 'Return failed.', { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  function openPay(orderId, debt, customerName) {
    setPayOrderId(orderId);
    setPayDebt(debt);
    setActiveCustomer((c) => c || { name: customerName });
    setPayAmount('');
    setPayMethod('Cash');
    setPayOpen(true);
  }

  async function confirmPay() {
    const amount = parseFloat(payAmount) || 0;
    if (amount <= 0) { showToast('Please enter a valid amount.', { type: 'error' }); return; }
    setSubmitting(true);
    try {
      const result = await payPautang([payOrderId], amount, payMethod);
      if (result?.success === false) throw new Error(result.message);
      showToast(result?.message || 'Payment recorded!', { type: 'success' });
      setPayOpen(false);
      if (activeCustomer) await openOrdersModal(activeCustomer);
      await reload();
    } catch (err) {
      if (err?.code === 'PGRST202') showToast('Run 003_pautang_rpc.sql in Supabase SQL Editor.', { type: 'error' });
      else showToast(err?.message || 'Payment failed.', { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  async function saveViewOverride() {
    if (!activeCustomer) return;
    setSubmitting(true);
    try {
      const result = await updateCustomer(activeCustomer.id, {
        ...customerPayload(activeCustomer),
        overrideOn: true,
        override5gal: Number(form.override5gal) || 0,
        override500: Number(form.override500) || 0,
        override1000: Number(form.override1000) || 0,
      });
      if (result?.success === false) throw new Error(result.message);
      showToast(result?.message || 'Override prices saved.', { type: 'success' });
      setViewOverrideOpen(false);
      await reload();
    } catch (err) {
      showToast(err?.message || 'Save failed.', { type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  const paidAmount = parseFloat(payAmount) || 0;
  let payStatusClass = 'status-utang';
  let payStatusText = 'Enter amount';
  let payStatusIcon = 'schedule';
  if (paidAmount > 0 && paidAmount < payDebt) {
    payStatusClass = 'status-partial';
    payStatusText = `Partial — ${formatPeso(payDebt - paidAmount)} remaining`;
    payStatusIcon = 'pie_chart';
  } else if (paidAmount >= payDebt && payDebt > 0) {
    payStatusClass = 'status-paid';
    payStatusText = 'Fully Paid!';
    payStatusIcon = 'check_circle';
  }

  const ordersTotal = orders.reduce((s, o) => s + (Number(o.remaining) || 0), 0);

  return (
    <div className="customers-page">
      <div className="customers-toolbar">
        <div className="search-bar">
          <input
            type="text"
            className="search-input"
            id="customerSearch"
            placeholder="Search customers..."
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
          />
          <div className="search-count">
            <span className="material-icons-outlined">people</span>
            <span id="customerCount">{filtered.length}</span> customers
          </div>
        </div>
        <div className="customers-toolbar-right">
          <button
            type="button"
            className={`btn-mass-edit${massEditMode ? ' active' : ''}`}
            id="massEditToggleBtn"
            onClick={() => (massEditMode ? exitMassEdit() : setMassEditMode(true))}
          >
            <span className="material-icons-outlined">{massEditMode ? 'close' : 'checklist'}</span>
            {massEditMode ? 'Exit Mass Edit' : 'Mass Edit'}
          </button>
          <button type="button" className="btn-add-staff" id="addCustomerBtn" onClick={openAdd}>
            <span className="material-icons-outlined">person_add</span> Add Customer
          </button>
        </div>
      </div>

      <div className="borrowed-totals-bar">
        <div className="borrowed-total-item">
          <span className="material-icons-outlined">water_drop</span>
          <span>{customers.reduce((s, c) => s + (Number(c.gallonSlim) || 0), 0)} Slim Gallon(s) currently out</span>
        </div>
        <div className="borrowed-total-item">
          <span className="material-icons-outlined">water_drop</span>
          <span>{customers.reduce((s, c) => s + (Number(c.gallonPoly) || 0), 0)} Poly Gallon(s) currently out</span>
        </div>
        <div className="borrowed-total-item">
          <span className="material-icons-outlined">inventory_2</span>
          <span>{customers.reduce((s, c) => s + (Number(c.dispenser) || 0), 0)} Dispenser(s) currently out</span>
        </div>
      </div>

      <div className="customers-filter-bar">
        <span className="filter-bar-label">
          <span className="material-icons-outlined">filter_list</span> Point Person:
        </span>
        <select
          className="filter-person-select"
          id="customerPointPersonFilter"
          value={ppFilter}
          onChange={(e) => setPpFilter(e.target.value)}
        >
          <option value="">All</option>
          {deliveryBoys.map((s) => (
            <option key={s.id} value={s.name.toLowerCase()}>{s.name}</option>
          ))}
        </select>
        <span className="filter-bar-label" style={{ marginLeft: 8 }}>
          <span className="material-icons-outlined">toggle_on</span> Status:
        </span>
        <select
          className="filter-person-select"
          id="customerStatusFilter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <div className="mass-edit-bar" id="massEditBar" style={{ display: massEditMode ? 'flex' : 'none' }}>
          <span id="massEditCount" style={{ fontSize: 13, color: 'hsl(var(--muted-fg))' }}>
            {selectedList.length} selected
            {massEditMixed && (
              <span style={{ color: 'hsl(var(--destructive))', fontSize: 12 }}> — Mixed point persons</span>
            )}
          </span>
          <select
            className="filter-person-select"
            id="massEditNewPP"
            style={{ minWidth: 180 }}
            value={massEditPP}
            onChange={(e) => setMassEditPP(e.target.value)}
          >
            <option value="">Assign Point Person...</option>
            {deliveryBoys.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
          <button
            type="button"
            className="btn-primary"
            id="massEditConfirmBtn"
            style={{ width: 'auto', padding: '8px 18px' }}
            disabled={!selectedList.length || !massEditPP || massEditMixed}
            onClick={() => setMassConfirmOpen(true)}
          >
            Apply to Selected
          </button>
          <button type="button" className="btn-cancel-delete" id="massEditCancelBtn" style={{ width: 'auto', padding: '8px 14px' }} onClick={exitMassEdit}>
            Cancel
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-body" style={{ overflowX: 'auto' }}>
          <table className="data-table" id="customersTable">
            <thead>
              <tr>
                <th id="checkboxHeaderCell" style={{ width: 36, display: massEditMode ? '' : 'none' }}>
                  <input
                    type="checkbox"
                    id="selectAllCheckbox"
                    title="Select all visible"
                    checked={pageData.length > 0 && pageData.every((c) => selectedIds.has(c.id))}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                  />
                </th>
                {SORT_COLS.map((col) => (
                  <th key={col}>
                    <div className="sort-header" data-col={col} onClick={() => toggleSort(col)}>
                      {COL_LABELS[col] || col.charAt(0).toUpperCase() + col.slice(1)}
                      {' '}
                      <span className={`sort-icon${sortCol === col ? (sortDir === 1 ? ' sort-asc' : ' sort-desc') : ''}`} id={`sort-${col}`}>
                        {sortIcon(col)}
                      </span>
                    </div>
                  </th>
                ))}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="customersTbody">
              {loading && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40 }}>Loading...</td></tr>
              )}
              {!loading && pageData.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'hsl(var(--muted-fg))' }}>No customers found</td></tr>
              )}
              {!loading && pageData.map((customer) => (
                <CustomerTableRow
                  key={customer.id}
                  customer={customer}
                  deliveryBoys={deliveryBoys}
                  massEditMode={massEditMode}
                  selected={selectedIds.has(customer.id)}
                  inlineSaving={inlineSaving}
                  onSelect={(id, checked) => {
                    setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(id);
                      else next.delete(id);
                      return next;
                    });
                  }}
                  onInlinePPChange={handleInlinePP}
                  onEdit={openEdit}
                  onOverrideView={(c) => {
                    setActiveCustomer(c);
                    setForm({
                      override5gal: c.override5gal || '',
                      override500: c.override500 || '',
                      override1000: c.override1000 || '',
                    });
                    setViewOverrideOpen(true);
                  }}
                  onBorrow={openBorrowModal}
                  onOrders={openOrdersModal}
                  onDelete={(c) => { setActiveCustomer(c); setDeleteOpen(true); }}
                />
              ))}
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 0 && (
          <div id="pg-customers" className="pagination-bar">
            <div className="pagination-info">
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(filtered.length, currentPage * pageSize)} of {filtered.length} results
            </div>
            <div className="pagination-right">
              <select
                className="pg-size-select"
                id="pg-customers-size"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>{size} / page</option>
                ))}
              </select>
              <button
                type="button"
                className="pg-nav-btn"
                id="pg-customers-prev"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <span className="material-icons-outlined">chevron_left</span>
              </button>
              <div className="pg-page-input-wrap">
                <input
                  type="number"
                  className="pg-page-input"
                  id="pg-customers-input"
                  value={currentPage}
                  min={1}
                  max={totalPages}
                  onChange={(e) => setPage(Math.min(totalPages, Math.max(1, Number(e.target.value))))}
                />
                <span className="pg-total-pages">of {totalPages}</span>
              </div>
              <button
                type="button"
                className="pg-nav-btn"
                id="pg-customers-next"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <span className="material-icons-outlined">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Customer Modal */}
      <div className={`pay-modal-overlay${addOpen ? ' show' : ''}`} id="addCustomerOverlay">
        <div className="pay-modal" style={{ maxWidth: 440 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title">Add New Customer</div>
            <button type="button" className="pdp-close-btn" id="addCustomerClose" onClick={() => setAddOpen(false)}>
              <span className="material-icons-outlined">close</span>
            </button>
          </div>
          <div className="pay-modal-body">
            <div className="pdp-field">
              <label className="pdp-label">Customer Name</label>
              <input type="text" className="pdp-input" id="addCustomerName" placeholder="Full name..." value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="pdp-field">
              <label className="pdp-label">Location</label>
              <input type="text" className="pdp-input" id="addCustomerLocation" placeholder="Address or area..." value={form.location || ''} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            </div>
            <div className="pdp-field">
              <label className="pdp-label">Point Person</label>
              <select className="pdp-select" id="addCustomerPointPerson" value={form.pointPerson || ''} onChange={(e) => setForm((f) => ({ ...f, pointPerson: e.target.value }))}>
                <option value="">Select staff...</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}{s.role ? ` (${s.role})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="pdp-field">
              <div className="override-toggle-row">
                <div>
                  <div className="pdp-label" style={{ marginBottom: 2 }}>Override Pricing</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--muted-fg))' }}>Set custom prices for this customer</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    id="addOverrideToggle"
                    checked={!!form.overrideOn}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setForm((f) => {
                        const next = { ...f, overrideOn: on };
                        if (on) {
                          next.override5gal = f.override5gal || defaultPrices.gal5 || '';
                          next.override500 = f.override500 || defaultPrices.ml500 || '';
                          next.override1000 = f.override1000 || defaultPrices.ml1000 || '';
                        }
                        return next;
                      });
                    }}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
            {form.overrideOn && (
              <div id="addOverridePrices">
                <OverridePricesFields prefix="add" values={form} onChange={(key, val) => setForm((f) => ({ ...f, [key]: val }))} />
              </div>
            )}
            <button type="button" className="btn-primary" id="addCustomerConfirm" disabled={submitting} onClick={() => saveAdd(false)}>
              {submitting ? 'Adding...' : 'Add Customer'}
            </button>
          </div>
        </div>
      </div>

      {/* Override confirm (add) */}
      <div className={`pay-modal-overlay${overrideConfirmOpen ? ' show' : ''}`} id="overrideConfirmOverlay">
        <div className="pay-modal" style={{ maxWidth: 400 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title">Confirm Override Pricing</div>
            <button type="button" className="pdp-close-btn" onClick={() => setOverrideConfirmOpen(false)}>
              <span className="material-icons-outlined">close</span>
            </button>
          </div>
          <div className="pay-modal-body">
            <div className="pay-modal-info">
              <div className="pay-modal-customer" id="overrideConfirmName">{pendingAdd?.name}</div>
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }} id="overrideConfirmPrices">
                <div className="override-confirm-row"><span>5 Gallon</span><strong>{formatPeso(pendingAdd?.override5gal)}</strong></div>
                <div className="override-confirm-row"><span>500 mL</span><strong>{formatPeso(pendingAdd?.override500)}</strong></div>
                <div className="override-confirm-row"><span>1000 mL</span><strong>{formatPeso(pendingAdd?.override1000)}</strong></div>
              </div>
              <div className="pay-modal-debt" style={{ marginTop: 10, color: 'hsl(var(--muted-fg))' }}>
                This customer will be charged these custom prices instead of the standard prices.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button type="button" className="btn-cancel-delete" onClick={() => setOverrideConfirmOpen(false)}>Cancel</button>
              <button type="button" className="btn-primary" style={{ flex: 1 }} disabled={submitting} onClick={() => saveAdd(true)}>
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Customer Modal */}
      <div className={`pay-modal-overlay${editOpen ? ' show' : ''}`} id="editCustomerOverlay">
        <div className="pay-modal" style={{ maxWidth: 440 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title">Edit Customer</div>
            <button type="button" className="pdp-close-btn" onClick={() => setEditOpen(false)}>
              <span className="material-icons-outlined">close</span>
            </button>
          </div>
          <div className="pay-modal-body">
            <div className="pdp-field">
              <label className="pdp-label">Customer Name</label>
              <input type="text" className="pdp-input" id="editCustomerName" value={form.name || ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="pdp-field">
              <label className="pdp-label">Location</label>
              <input type="text" className="pdp-input" id="editCustomerLocation" value={form.location || ''} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
            </div>
            <div className="pdp-field">
              <label className="pdp-label">Point Person</label>
              <select className="pdp-select" id="editCustomerPointPerson" value={form.pointPerson || ''} onChange={(e) => setForm((f) => ({ ...f, pointPerson: e.target.value }))}>
                <option value="">Select staff...</option>
                {staff.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}{s.role ? ` (${s.role})` : ''}</option>
                ))}
              </select>
            </div>
            <div className="pdp-field">
              <div className="override-toggle-row">
                <div>
                  <div className="pdp-label" style={{ marginBottom: 2 }}>Override Pricing</div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--muted-fg))' }}>Set custom prices for this customer</div>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    id="editOverrideToggle"
                    checked={!!form.overrideOn}
                    onChange={(e) => {
                      const on = e.target.checked;
                      setForm((f) => {
                        const next = { ...f, overrideOn: on };
                        if (on) fillDefaultPrices(next, () => next);
                        return next;
                      });
                    }}
                  />
                  <span className="toggle-slider" />
                </label>
              </div>
            </div>
            {form.overrideOn && (
              <div id="editOverridePrices">
                <OverridePricesFields prefix="edit" values={form} onChange={(key, val) => setForm((f) => ({ ...f, [key]: val }))} />
              </div>
            )}
            <button type="button" className="btn-primary" id="editCustomerConfirm" disabled={submitting} onClick={saveEdit}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {/* View Override Modal */}
      <div className={`pay-modal-overlay${viewOverrideOpen ? ' show' : ''}`} id="viewOverrideOverlay">
        <div className="pay-modal" style={{ maxWidth: 420 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title" id="viewOverrideTitle">{activeCustomer?.name} — Override Prices</div>
            <button type="button" className="pdp-close-btn" onClick={() => setViewOverrideOpen(false)}>
              <span className="material-icons-outlined">close</span>
            </button>
          </div>
          <div className="pay-modal-body">
            <OverridePricesFields prefix="view" values={form} onChange={(key, val) => setForm((f) => ({ ...f, [key]: val }))} />
            <button type="button" className="btn-primary" id="viewOverrideSave" disabled={submitting} onClick={saveViewOverride}>
              Save Override Prices
            </button>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      <div className={`pay-modal-overlay${deleteOpen ? ' show' : ''}`} id="deleteCustomerOverlay">
        <div className="pay-modal" style={{ maxWidth: 360 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title">Delete Customer</div>
            <button type="button" className="pdp-close-btn" onClick={() => setDeleteOpen(false)}>
              <span className="material-icons-outlined">close</span>
            </button>
          </div>
          <div className="pay-modal-body">
            <div className="pay-modal-info">
              <div className="pay-modal-customer" id="deleteCustomerName">{activeCustomer?.name}</div>
              <div className="pay-modal-debt" style={{ color: 'hsl(var(--destructive))' }}>This will permanently remove the customer.</div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn-cancel-delete" id="deleteCustomerCancel" onClick={() => setDeleteOpen(false)}>Cancel</button>
              <button type="button" className="btn-primary" id="deleteCustomerConfirm" style={{ background: 'hsl(var(--destructive))', flex: 1 }} disabled={submitting} onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mass edit confirm */}
      <div className={`pay-modal-overlay${massConfirmOpen ? ' show' : ''}`} id="massEditConfirmOverlay">
        <div className="pay-modal" style={{ maxWidth: 420 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title">Confirm Mass Edit</div>
            <button type="button" className="pdp-close-btn" onClick={() => setMassConfirmOpen(false)}>
              <span className="material-icons-outlined">close</span>
            </button>
          </div>
          <div className="pay-modal-body">
            <div className="pay-modal-info">
              <div className="pay-modal-customer" id="massConfirmTitle">
                Assign &quot;{massEditPP}&quot; to {selectedList.length} customer{selectedList.length > 1 ? 's' : ''}?
              </div>
              <div className="pay-modal-debt" id="massConfirmDesc" style={{ marginTop: 8, lineHeight: 1.6 }}>
                {selectedList.map((c) => c.name).join(', ')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn-cancel-delete" style={{ flex: 1 }} onClick={() => setMassConfirmOpen(false)}>Cancel</button>
              <button type="button" className="btn-primary" id="massEditDoConfirmBtn" style={{ flex: 1 }} disabled={submitting} onClick={applyMassEdit}>
                Yes, Update All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Outstanding Orders Modal */}
      <div className={`pay-modal-overlay${ordersOpen ? ' show' : ''}`} id="customerOrdersOverlay" data-shift={shiftOpen ? '1' : '0'}>
        <div className="pay-modal" style={{ maxWidth: 640, width: '95%' }}>
          <div className="pay-modal-header">
            <div>
              <div className="pay-modal-title" id="customerOrdersTitle">{activeCustomer?.name} — Outstanding Orders</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--muted-fg))', marginTop: 2 }}>Unpaid & partial orders only</div>
            </div>
            <button type="button" className="pdp-close-btn" id="customerOrdersClose" onClick={() => setOrdersOpen(false)}>
              <span className="material-icons-outlined">close</span>
            </button>
          </div>
          <div className="pay-modal-body" style={{ padding: 0 }}>
            <div className="customer-orders-summary" id="customerOrdersSummary">
              <div className="customer-orders-total">
                <span>Total Outstanding Balance</span>
                <span className="customer-orders-amount">{formatPeso(ordersTotal || activeCustomer?.utang || 0)}</span>
              </div>
            </div>
            <div id="customerOrdersBody" style={{ maxHeight: 420, overflowY: 'auto', padding: '0 20px 20px' }}>
              {ordersLoading && <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>}
              {!ordersLoading && orders.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--muted-fg))' }}>No outstanding orders found</div>
              )}
              {!ordersLoading && orders.map((o) => {
                const totalPaid = o.payments.reduce((s, p) => s + p.amount, 0);
                const productDisplay = o.product + (o.qty ? ` x ${o.qty}` : '') + (o.slimPoly && o.product === '5 Gallon' ? ` (${o.slimPoly})` : '');
                const stCls = o.status === 'Partial' ? 'badge-warning' : 'badge-danger';
                return (
                  <div key={o.id} className="order-card">
                    <div className="order-card-header">
                      <div className="order-card-left">
                        <div className="order-card-id">{o.id}</div>
                        <div className="order-card-meta">
                          {o.date}{o.time ? <> · {o.time}</> : null}{o.pointPerson ? <> · <span style={{ color: 'hsl(var(--primary))' }}>{o.pointPerson}</span></> : null}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className={`badge ${stCls}`}>{o.status}</span>
                        {shiftOpen && o.remaining > 0 && (
                          <button type="button" className="pay-btn order-pay-btn" onClick={() => openPay(o.id, o.remaining, activeCustomer?.name)}>
                            <span className="material-icons-outlined">payments</span> Pay
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="order-card-details">
                      <div className="order-card-detail"><div className="order-detail-label">Product</div><div className="order-detail-val">{productDisplay}</div></div>
                      <div className="order-card-detail"><div className="order-detail-label">Order Total</div><div className="order-detail-val">{formatPeso(o.originalTotal)}</div></div>
                      <div className="order-card-detail"><div className="order-detail-label">Already Paid</div><div className="order-detail-val text-success">{formatPeso(totalPaid)}</div></div>
                      <div className="order-card-detail"><div className="order-detail-label">Balance</div><div className="order-detail-val text-danger text-bold">{formatPeso(o.remaining)}</div></div>
                    </div>
                    {o.payments.length > 0 && (
                      <div className="order-payments">
                        <div className="order-payments-title"><span className="material-icons-outlined">history</span> Payment History</div>
                        {o.payments.map((pay, idx) => (
                          <div key={idx} className="order-payment-row">
                            <div className="order-payment-left">
                              <span className="material-icons-outlined" style={{ color: 'hsl(150,40%,35%)', fontSize: 16 }}>check_circle</span>
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600 }}>{formatPeso(pay.amount)} paid</div>
                                <div style={{ fontSize: 11, color: 'hsl(var(--muted-fg))' }}>{pay.date}{pay.time ? ` · ${pay.time}` : ''}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Borrow History Modal */}
      <div className={`pay-modal-overlay${borrowOpen ? ' show' : ''}`} id="borrowHistoryOverlay">
        <div className="pay-modal" style={{ maxWidth: 640, width: '95%' }}>
          <div className="pay-modal-header">
            <div>
              <div className="pay-modal-title" id="borrowHistoryTitle">{activeCustomer?.name} — Borrowed Items</div>
              <div style={{ fontSize: 12, color: 'hsl(var(--muted-fg))', marginTop: 2 }}>Partially returned items only</div>
            </div>
            <button type="button" className="pdp-close-btn" id="borrowHistoryClose" onClick={() => setBorrowOpen(false)}>
              <span className="material-icons-outlined">close</span>
            </button>
          </div>
          <div className="pay-modal-body" style={{ padding: 0 }}>
            {!borrowReturnMode && (
              <>
                <div className="customer-orders-summary" id="borrowHistorySummary">
                  <div className="customer-orders-total">
                    <span>Currently Borrowed</span>
                    <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {borrowData?.gallonBuckets?.map((b) => (
                        <span key={b.type} className="borrow-badge borrow-badge-gallon" style={{ fontSize: 14 }}>
                          <span className="material-icons-outlined">water_drop</span>
                          {b.currentTotal} {b.type === 'Unknown' ? 'Gallon' : `${b.type} Gallon`}(s) out
                        </span>
                      ))}
                      {borrowData?.currentDispenser > 0 && (
                        <span className="borrow-badge borrow-badge-dispenser" style={{ fontSize: 14 }}>
                          <span className="material-icons-outlined">inventory_2</span>
                          {borrowData.currentDispenser} Dispenser(s) out
                        </span>
                      )}
                      {!(borrowData?.gallonBuckets?.length) && !borrowData?.currentDispenser && (
                        <span style={{ color: 'hsl(var(--muted-fg))', fontSize: 14 }}>All returned</span>
                      )}
                    </span>
                  </div>
                </div>
                <div id="borrowHistoryBody" style={{ maxHeight: 420, overflowY: 'auto', padding: '0 20px 20px' }}>
                  {borrowLoading && <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>}
                  {!borrowLoading && !(borrowData?.gallonBuckets?.some((b) => b.borrows.length) || borrowData?.dispenserBorrows?.length) && (
                    <div style={{ padding: 40, textAlign: 'center', color: 'hsl(var(--muted-fg))' }}>No outstanding borrowed items</div>
                  )}
                  {!borrowLoading && borrowData?.gallonBuckets?.map((bucket) => bucket.borrows.map((b) => (
                    <div key={b.borrowId} className="order-card">
                      <div className="order-card-header">
                        <div className="order-card-left">
                          <div className="order-card-id">{b.borrowId}</div>
                          <div className="order-card-meta">{b.date}{bucket.type !== 'Unknown' ? ` · ${bucket.type}` : ''}</div>
                        </div>
                        <button
                          type="button"
                          className="pay-btn order-pay-btn borrow-return-trigger"
                          onClick={openReturnForm}
                        >
                          <span className="material-icons-outlined">undo</span> Return
                        </button>
                      </div>
                      <div className="order-card-details">
                        <div className="order-card-detail"><div className="order-detail-label">{bucket.type === 'Unknown' ? 'Gallon' : `${bucket.type} Gallon`} Borrowed</div><div className="order-detail-val">{b.original}</div></div>
                        {b.returned > 0 && <div className="order-card-detail"><div className="order-detail-label">Already Returned</div><div className="order-detail-val text-success">{b.returned}</div></div>}
                        <div className="order-card-detail"><div className="order-detail-label">Still Out</div><div className="order-detail-val text-danger text-bold">{b.remaining}</div></div>
                      </div>
                    </div>
                  )))}
                  {!borrowLoading && borrowData?.dispenserBorrows?.map((b) => (
                    <div key={b.borrowId} className="order-card">
                      <div className="order-card-header">
                        <div className="order-card-left">
                          <div className="order-card-id">{b.borrowId}</div>
                          <div className="order-card-meta">{b.date} · Dispenser</div>
                        </div>
                        <button
                          type="button"
                          className="pay-btn order-pay-btn borrow-return-trigger"
                          onClick={openReturnForm}
                        >
                          <span className="material-icons-outlined">undo</span> Return
                        </button>
                      </div>
                      <div className="order-card-details">
                        <div className="order-card-detail"><div className="order-detail-label">Dispenser Borrowed</div><div className="order-detail-val">{b.original}</div></div>
                        {b.returned > 0 && <div className="order-card-detail"><div className="order-detail-label">Already Returned</div><div className="order-detail-val text-success">{b.returned}</div></div>}
                        <div className="order-card-detail"><div className="order-detail-label">Still Out</div><div className="order-detail-val text-danger text-bold">{b.remaining}</div></div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {borrowReturnMode && activeCustomer && (
              <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 20, borderBottom: '1px solid hsl(var(--border))' }}>
                  <button type="button" id="rhBackBtn" style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setBorrowReturnMode(false)}>
                    <span className="material-icons-outlined" style={{ fontSize: 18 }}>arrow_back</span>
                  </button>
                  <div style={{ fontSize: 15, fontWeight: 700 }}>{activeCustomer.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'hsl(var(--muted-fg))', marginLeft: 'auto' }}>Record Return</div>
                </div>
                {borrowData?.gallonBuckets?.filter((b) => b.currentTotal > 0).map((bucket) => (
                  <div key={bucket.type} className="pdp-field" style={{ gap: 10 }}>
                    <label className="pdp-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <span className="material-icons-outlined" style={{ fontSize: 15, color: 'hsl(210,60%,50%)' }}>water_drop</span>
                      {(bucket.type === 'Unknown' ? 'GALLONS' : `${bucket.type.toUpperCase()} GALLONS`)} TO RETURN
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button type="button" className="qty-btn" onClick={() => setReturnAmounts((prev) => ({ ...prev, [bucket.type]: Math.max(0, (prev[bucket.type] || 0) - 1) }))}>−</button>
                      <input
                        type="number"
                        className="pdp-qty-input"
                        value={returnAmounts[bucket.type] || 0}
                        min={0}
                        max={bucket.currentTotal}
                        onChange={(e) => setReturnAmounts((prev) => ({ ...prev, [bucket.type]: Math.min(bucket.currentTotal, Math.max(0, Number(e.target.value) || 0)) }))}
                      />
                      <button type="button" className="qty-btn" onClick={() => setReturnAmounts((prev) => ({ ...prev, [bucket.type]: Math.min(bucket.currentTotal, (prev[bucket.type] || 0) + 1) }))}>+</button>
                      <span style={{ fontSize: 12, color: 'hsl(var(--muted-fg))' }}>of <strong>{bucket.currentTotal}</strong> out</span>
                    </div>
                  </div>
                ))}
                {borrowData?.currentDispenser > 0 && (
                  <div className="pdp-field" style={{ gap: 10 }}>
                    <label className="pdp-label" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                      <span className="material-icons-outlined" style={{ fontSize: 15, color: 'hsl(38,65%,45%)' }}>inventory_2</span>
                      DISPENSERS TO RETURN
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button type="button" className="qty-btn" onClick={() => setReturnDispenser((v) => Math.max(0, v - 1))}>−</button>
                      <input type="number" className="pdp-qty-input" value={returnDispenser} min={0} max={borrowData.currentDispenser} onChange={(e) => setReturnDispenser(Math.min(borrowData.currentDispenser, Math.max(0, Number(e.target.value) || 0)))} />
                      <button type="button" className="qty-btn" onClick={() => setReturnDispenser((v) => Math.min(borrowData.currentDispenser, v + 1))}>+</button>
                      <span style={{ fontSize: 12, color: 'hsl(var(--muted-fg))' }}>of <strong>{borrowData.currentDispenser}</strong> out</span>
                    </div>
                  </div>
                )}
                <button type="button" className="btn-primary" id="rhConfirmBtn" disabled={submitting} onClick={confirmReturn}>
                  <span className="material-icons-outlined" style={{ fontSize: 17 }}>undo</span>
                  {submitting ? 'Processing...' : 'Confirm Return'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pay Modal */}
      <div className={`pay-modal-overlay${payOpen ? ' show' : ''}`} id="custPayModalOverlay">
        <div className="pay-modal">
          <div className="pay-modal-header">
            <div className="pay-modal-title">Record Payment</div>
            <button type="button" className="pdp-close-btn" id="custPayModalClose" onClick={() => setPayOpen(false)}>
              <span className="material-icons-outlined">close</span>
            </button>
          </div>
          <div className="pay-modal-body">
            <div className="pay-modal-info">
              <div className="pay-modal-customer" id="custPayModalCustomer">{activeCustomer?.name} {payOrderId}</div>
              <div className="pay-modal-debt">Outstanding: <strong id="custPayModalDebt">{formatPeso(payDebt)}</strong></div>
            </div>
            <div className="pdp-field">
              <label className="pdp-label">Amount Paid</label>
              <div className="pdp-amount-row">
                <input type="number" className="pdp-input" id="custPayModalAmount" placeholder="0.00" min={0} max={payDebt} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                <button type="button" className="btn-exact" id="custPayModalExact" onClick={() => setPayAmount(String(payDebt))}>Exact</button>
              </div>
            </div>
            <div className="pdp-pay-method-row">
              <label className="pdp-pay-method-option">
                <input type="radio" name="custPayModalMethod" value="Cash" checked={payMethod === 'Cash'} onChange={() => setPayMethod('Cash')} />
                <span className="material-icons-outlined">payments</span> Cash
              </label>
              <label className="pdp-pay-method-option">
                <input type="radio" name="custPayModalMethod" value="GCash" checked={payMethod === 'GCash'} onChange={() => setPayMethod('GCash')} />
                <span className="material-icons-outlined">smartphone</span> GCash
              </label>
            </div>
            <div className={`pdp-status-pill ${payStatusClass}`} id="custPayModalStatus">
              <span className="material-icons-outlined">{payStatusIcon}</span>
              <span id="custPayModalStatusText">{payStatusText}</span>
            </div>
            <button type="button" className="btn-primary" id="custPayModalConfirm" disabled={submitting} onClick={confirmPay}>
              {submitting ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
