import { useCallback, useEffect, useMemo, useState } from 'react';
import LogbookColumn from './LogbookColumn.jsx';
import RequireShift from '../../../components/features/shift/RequireShift.jsx';
import {
  getLogbookData,
  markLogbookDelivered,
  toggleTipClaimed,
  voidLogbookOrder,
  updateLogbookPointPerson,
  splitLogbookPartialReassign,
  payPautang,
} from '../../../api/logbook.js';
import { formatPeso } from '../../../utils/format.js';
import { showToast as notify } from '../../../utils/toast.js';
import './logbook.css';

const HIDDEN_KEY = 'lbHiddenColumns';

function loadHidden() {
  try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'); } catch { return []; }
}
function saveHidden(arr) {
  try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(arr)); } catch { /* ignore */ }
}

function LogbookPageContent() {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [staff, setStaff] = useState([]);
  const [products, setProducts] = useState([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('undelivered');
  const [dateTab, setDateTab] = useState('all');
  const [productFilter, setProductFilter] = useState('');
  const [groupMode, setGroupMode] = useState('date');
  const [locationFilter, setLocationFilter] = useState('');

  const [hiddenColumns, setHiddenColumns] = useState(loadHidden);

  const [massSelectMode, setMassSelectMode] = useState(false);
  const [selectedLogIds, setSelectedLogIds] = useState(new Set());
  const [selectedLocations, setSelectedLocations] = useState(new Set());
  const [showLocPanel, setShowLocPanel] = useState(false);

  const [deliverEntry, setDeliverEntry] = useState(null);
  const [partialQty, setPartialQty] = useState(1);
  const [showPartialQty, setShowPartialQty] = useState(false);

  const [tipEntry, setTipEntry] = useState(null);
  const [claimAll, setClaimAll] = useState(null); // { person, entries }
  const [hideTarget, setHideTarget] = useState(null); // { key, label }
  const [voidTarget, setVoidTarget] = useState(null); // entry
  const [reassign, setReassign] = useState(null); // { entries: [...], newPerson, isMass }
  const [massDeliverOpen, setMassDeliverOpen] = useState(false);

  const [payEntry, setPayEntry] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [paySubmitting, setPaySubmitting] = useState(false);

  const [dragIds, setDragIds] = useState(null);

  const showToast = useCallback((msg) => notify(msg), []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLogbookData();
      setEntries(data.entries);
      setStaff(data.staff);
      setProducts(data.products);
    } catch (err) {
      showToast(err?.message || 'Failed to load logbook.', { type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { reload(); }, [reload]);

  const filtered = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const q = search.toLowerCase().trim();

    return entries.filter((e) => {
      if (statusFilter === 'undelivered' && e.status === 'Delivered') return false;
      if (statusFilter === 'delivered' && e.status !== 'Delivered') return false;

      const dateSource = (statusFilter === 'delivered' && e.deliveredDate) ? e.deliveredDate : e.date;
      const d = new Date(dateSource); d.setHours(0, 0, 0, 0);
      if (dateTab === 'today' && d.getTime() !== today.getTime()) return false;
      if (dateTab === 'yesterday' && d.getTime() !== yesterday.getTime()) return false;

      if (productFilter && (e.product || '').toLowerCase() !== productFilter) return false;

      if (locationFilter) {
        const loc = e.location?.trim() ? e.location.trim().toLowerCase() : 'no location';
        if (loc !== locationFilter.toLowerCase()) return false;
      }

      if (q) {
        const match = (e.customerName || '').toLowerCase().includes(q)
          || (e.location || '').toLowerCase().includes(q)
          || (e.orderId || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [entries, statusFilter, dateTab, productFilter, locationFilter, search]);

  const locationOptions = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => set.add(e.location?.trim() || 'No Location'));
    return Array.from(set).sort((a, b) => (a === 'No Location' ? 1 : b === 'No Location' ? -1 : a.localeCompare(b)));
  }, [entries]);

  const visibleColumns = useMemo(() => {
    const cols = staff
      .filter((s) => !hiddenColumns.includes(s.name.toLowerCase()))
      .map((s) => ({ key: s.name.toLowerCase(), title: s.name, entries: filtered.filter((e) => (e.pointPerson || '').toLowerCase() === s.name.toLowerCase()) }));
    if (!hiddenColumns.includes('no point person')) {
      cols.push({ key: 'no point person', title: 'No Point Person', entries: filtered.filter((e) => !e.pointPerson?.trim()) });
    }
    return cols;
  }, [staff, filtered, hiddenColumns]);

  function toggleHiddenColumn(key) {
    setHiddenColumns((prev) => {
      const idx = prev.indexOf(key);
      const next = idx === -1 ? [...prev, key] : prev.filter((k) => k !== key);
      saveHidden(next);
      return next;
    });
  }

  // ---- Mass select ----
  function enterMassSelect() { setMassSelectMode(true); setSelectedLogIds(new Set()); }
  function exitMassSelect() {
    setMassSelectMode(false);
    setSelectedLogIds(new Set());
    setSelectedLocations(new Set());
    setShowLocPanel(false);
  }
  function toggleSelect(entry) {
    if (entry.status === 'Delivered') return;
    setSelectedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(entry.logId)) next.delete(entry.logId); else next.add(entry.logId);
      return next;
    });
  }
  function toggleLocationChip(loc) {
    const cardsForLoc = filtered.filter((e) => (e.location?.trim() || 'No Location') === loc && e.status !== 'Delivered');
    setSelectedLocations((prev) => {
      const next = new Set(prev);
      const active = next.has(loc);
      if (active) next.delete(loc); else next.add(loc);
      setSelectedLogIds((prevIds) => {
        const nextIds = new Set(prevIds);
        cardsForLoc.forEach((c) => (active ? nextIds.delete(c.logId) : nextIds.add(c.logId)));
        return nextIds;
      });
      return next;
    });
  }

  const selectedEntries = useMemo(() => entries.filter((e) => selectedLogIds.has(e.logId)), [entries, selectedLogIds]);
  const canVoidSelected = selectedLogIds.size === 1 && selectedEntries[0]?.status === 'Undelivered';

  // ---- Deliver modal ----
  function openDeliverModal(entry) {
    setDeliverEntry(entry);
    setShowPartialQty(false);
    setPartialQty(Math.max(1, entry.qty - 1));
  }
  function closeDeliverModal() { setDeliverEntry(null); setShowPartialQty(false); }

  async function applyStatus(newStatus, qty = 0) {
    if (!deliverEntry) return;
    const logId = deliverEntry.logId;
    closeDeliverModal();
    try {
      const result = await markLogbookDelivered(logId, newStatus, qty);
      setEntries((prev) => prev.map((e) => {
        if (e.logId !== logId) return e;
        return {
          ...e,
          status: newStatus,
          deliveredTime: result.deliveredTime || '',
          deliveredDate: result.deliveredDate || '',
          deliveredQty: newStatus === 'Partial' ? qty : newStatus === 'Delivered' ? e.qty : 0,
          deliveryAttempts: result.deliveryAttempts ?? e.deliveryAttempts,
        };
      }));
      showToast(`Status updated to ${newStatus}`, { type: 'success' });
    } catch (err) {
      showToast(err?.message || 'Update failed.', { type: 'error' });
    }
  }

  // ---- Tip ----
  async function confirmTip() {
    if (!tipEntry) return;
    try {
      const result = await toggleTipClaimed(tipEntry.logId);
      setEntries((prev) => prev.map((e) => (e.logId === tipEntry.logId ? { ...e, tipClaimed: result.tipClaimed } : e)));
      setTipEntry(null);
    } catch (err) {
      showToast(err?.message || 'Update failed.', { type: 'error' });
    }
  }

  async function confirmClaimAll() {
    if (!claimAll) return;
    let hasError = false;
    for (const en of claimAll.entries) {
      try {
        const result = await toggleTipClaimed(en.logId);
        setEntries((prev) => prev.map((e) => (e.logId === en.logId ? { ...e, tipClaimed: result.tipClaimed } : e)));
      } catch { hasError = true; }
    }
    showToast(hasError ? 'Some tips failed to update.' : `${claimAll.entries.length} tips marked as claimed!`, { type: 'success' });
    setClaimAll(null);
  }

  // ---- Pay ----
  function openPay(entry) {
    setPayEntry(entry);
    setPayAmount('');
    setPayMethod('Cash');
  }
  async function confirmPay() {
    if (!payEntry) return;
    const amount = parseFloat(payAmount) || 0;
    if (amount <= 0) { showToast('Please enter a valid amount.', { type: 'error' }); return; }
    setPaySubmitting(true);
    try {
      const result = await payPautang([payEntry.orderId], amount, payMethod);
      if (result?.success === false) throw new Error(result.message);
      showToast(result?.message || 'Payment recorded!', { type: 'success' });
      const newBalance = Math.max(0, payEntry.paymentBalance - amount);
      setEntries((prev) => prev.map((e) => (e.orderId === payEntry.orderId
        ? { ...e, paymentBalance: newBalance, paymentStatus: newBalance <= 0 ? 'Paid' : 'Partial' }
        : e)));
      setPayEntry(null);
    } catch (err) {
      showToast(err?.message || 'Payment failed.', { type: 'error' });
    } finally {
      setPaySubmitting(false);
    }
  }

  // ---- Void ----
  async function confirmVoid() {
    if (!voidTarget) return;
    try {
      const result = await voidLogbookOrder(voidTarget.logId, voidTarget.orderId);
      if (result?.success === false) throw new Error(result.message);
      setEntries((prev) => prev.filter((e) => e.logId !== voidTarget.logId));
      showToast(result.message, { type: 'success' });
      setVoidTarget(null);
      if (massSelectMode) exitMassSelect();
    } catch (err) {
      showToast(err?.message || 'Void failed.', { type: 'error' });
    }
  }

  // ---- Reassign (drag/drop) ----
  function handleDragStart(ev, entry) {
    if (entry.status === 'Delivered') { ev.preventDefault(); return; }
    let ids = [entry.logId];
    if (massSelectMode && selectedLogIds.size > 0) {
      const next = new Set(selectedLogIds);
      next.add(entry.logId);
      setSelectedLogIds(next);
      ids = Array.from(next);
    }
    setDragIds(ids);
    ev.dataTransfer.effectAllowed = 'move';
  }
  function handleDragEnd() { setDragIds(null); }
  function handleDragOverColumn(ev) { if (dragIds) { ev.preventDefault(); ev.dataTransfer.dropEffect = 'move'; } }

  function handleDropColumn(ev, newPerson) {
    ev.preventDefault();
    if (!dragIds || !dragIds.length) return;
    const moving = dragIds.map((id) => entries.find((e) => e.logId === id)).filter((e) => e && e.status !== 'Delivered');

    if (moving.length > 1) {
      const toMove = moving.filter((e) => (e.pointPerson || '').toLowerCase() !== newPerson.toLowerCase());
      if (!toMove.length) { setDragIds(null); return; }
      setReassign({ entries: toMove, newPerson, isMass: true });
    } else if (moving.length === 1) {
      const entry = moving[0];
      if ((entry.pointPerson || '').toLowerCase() === newPerson.toLowerCase()) { setDragIds(null); return; }
      setReassign({ entries: [entry], newPerson, isMass: false });
    }
    setDragIds(null);
  }

  async function confirmReassign() {
    if (!reassign) return;
    const { entries: toMove, newPerson } = reassign;
    let hasError = false;
    const newRows = [];

    for (const en of toMove) {
      const isPartialSplit = en.status === 'Partial' && en.deliveredQty > 0 && en.deliveredQty < en.qty;
      try {
        if (isPartialSplit) {
          const result = await splitLogbookPartialReassign(en.logId, en.orderId, newPerson);
          if (result?.success === false) throw new Error(result.message);
          setEntries((prev) => prev.map((e) => (e.logId === en.logId ? { ...e, status: 'Delivered', qty: en.deliveredQty } : e)));
          if (result.newEntry) newRows.push(result.newEntry);
        } else {
          const result = await updateLogbookPointPerson(en.logId, en.orderId, newPerson);
          if (result?.success === false) throw new Error(result.message);
          setEntries((prev) => prev.map((e) => (e.logId === en.logId ? { ...e, pointPerson: newPerson } : e)));
        }
      } catch {
        hasError = true;
      }
    }
    if (newRows.length) setEntries((prev) => [...prev, ...newRows]);

    showToast(hasError ? 'Some updates failed.' : `${toMove.length === 1 ? 'Order' : `${toMove.length} orders`} reassigned to ${newPerson || 'No point person'}!`, { type: 'success' });
    setReassign(null);
    if (massSelectMode) exitMassSelect();
  }

  // ---- Mass deliver ----
  async function confirmMassDeliver() {
    let hasError = false;
    for (const logId of selectedLogIds) {
      const entry = entries.find((e) => e.logId === logId);
      if (!entry || entry.status === 'Delivered') continue;
      try {
        const result = await markLogbookDelivered(logId, 'Delivered', 0);
        setEntries((prev) => prev.map((e) => (e.logId === logId
          ? { ...e, status: 'Delivered', qty_delivered: e.qty, deliveredTime: result.deliveredTime, deliveredDate: result.deliveredDate }
          : e)));
      } catch { hasError = true; }
    }
    showToast(hasError ? 'Some updates failed.' : `${selectedLogIds.size} orders marked delivered!`, { type: 'success' });
    setMassDeliverOpen(false);
    exitMassSelect();
  }

  const paidAmount = parseFloat(payAmount) || 0;
  const payDebt = payEntry?.paymentBalance || 0;

  return (
    <div className="logbook-page">
      <div className="lb-toolbar">
        <div className="lb-toolbar-row lb-toolbar-row-main">
          <div className="lb-search-wrap">
            <span className="material-icons-outlined lb-search-icon">search</span>
            <input
              type="text" className="search-input lb-search-input"
              placeholder="Search customer, order ID, location..."
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="lb-search-clear" onClick={() => setSearch('')}>
                <span className="material-icons-outlined">close</span>
              </button>
            )}
          </div>

          <select className="lb-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="undelivered">Undelivered</option>
            <option value="delivered">Delivered</option>
            <option value="all">All statuses</option>
          </select>

          <div className="lb-filter-tabs">
            {['today', 'yesterday', 'all'].map((val) => (
              <button
                key={val}
                type="button"
                className={`filter-tab${dateTab === val ? ' active' : ''}`}
                onClick={() => setDateTab(val)}
              >
                {val === 'today' ? 'Today' : val === 'yesterday' ? 'Yesterday' : 'All'}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="lb-massselect-btn"
            title="Mass select"
            onClick={() => (massSelectMode ? exitMassSelect() : enterMassSelect())}
          >
            <span className="material-icons-outlined">checklist</span>
            <span className="lb-btn-text">{massSelectMode ? 'Cancel' : 'Select'}</span>
          </button>
        </div>

        <div className="lb-toolbar-row lb-toolbar-row-sub">
          <span className="lb-toolbar-label"><span className="material-icons-outlined">tune</span>Filters</span>
          <select className="lb-select lb-select-quiet" value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
            <option value="">All Products</option>
            {products.map((p) => <option key={p} value={p.toLowerCase()}>{p}</option>)}
          </select>
          <select
            className="lb-select lb-select-quiet"
            value={groupMode}
            onChange={(e) => { setGroupMode(e.target.value); setLocationFilter(''); }}
          >
            <option value="date">Group by Date</option>
            <option value="location">Group by Location</option>
          </select>
          {groupMode === 'location' && (
            <select className="lb-select lb-select-quiet" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)}>
              <option value="">Select Location</option>
              {locationOptions.map((loc) => <option key={loc} value={loc.toLowerCase()}>{loc.toUpperCase()}</option>)}
            </select>
          )}
        </div>
      </div>

      {hiddenColumns.length > 0 && (
        <div className="lb-hidden-bar">
          <span className="lb-hidden-bar-label">Hidden:</span>
          {[...staff.map((s) => ({ key: s.name.toLowerCase(), label: s.name })), { key: 'no point person', label: 'No Point Person' }]
            .filter((d) => hiddenColumns.includes(d.key))
            .map((d) => (
              <button key={d.key} type="button" className="lb-hidden-chip" onClick={() => toggleHiddenColumn(d.key)}>
                <span className="material-icons-outlined">visibility</span>{d.label}
              </button>
            ))}
        </div>
      )}

      {massSelectMode && (
        <div id="lbMassBar" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{selectedLogIds.size} selected</span>
          <button type="button" className="btn-primary" style={{ width: 'auto', padding: '7px 16px', fontSize: 13 }} disabled={!selectedLogIds.size} onClick={() => setMassDeliverOpen(true)}>
            <span className="material-icons-outlined" style={{ fontSize: 16 }}>check_circle</span> Mark Delivered
          </button>
          <button type="button" className="btn-destructive" style={{ width: 'auto', padding: '7px 16px', fontSize: 13 }} disabled={!canVoidSelected} onClick={() => setVoidTarget(selectedEntries[0])}>
            <span className="material-icons-outlined" style={{ fontSize: 16 }}>delete_outline</span> Void Order
          </button>
          <button type="button" className="btn-cancel-delete" style={{ width: 'auto', padding: '7px 14px', fontSize: 13 }} onClick={() => setShowLocPanel((v) => !v)}>
            <span className="material-icons-outlined" style={{ fontSize: 16 }}>place</span> By Location
          </button>
          <span style={{ fontSize: 12, color: 'var(--muted-fg)' }}>or drag any selected card to reassign all</span>
          <button type="button" className="btn-cancel-delete" style={{ width: 'auto', padding: '7px 14px', fontSize: 13, marginLeft: 'auto' }} onClick={exitMassSelect}>Cancel</button>
        </div>
      )}

      {massSelectMode && showLocPanel && (
        <div id="lbLocationBar" style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 0 4px' }}>
          {locationOptions
            .filter((loc) => filtered.some((e) => (e.location?.trim() || 'No Location') === loc && e.status !== 'Delivered'))
            .map((loc) => (
              <button key={loc} type="button" className={`lb-loc-chip${selectedLocations.has(loc) ? ' active' : ''}`} onClick={() => toggleLocationChip(loc)}>
                {loc.toUpperCase()}
              </button>
            ))}
        </div>
      )}

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /><p>Loading logbook...</p></div>
      ) : (
        <div className="lb-board">
          {visibleColumns.map((col) => (
            <LogbookColumn
              key={col.key}
              title={col.title}
              colKey={col.key}
              entries={col.entries}
              groupMode={groupMode}
              massSelectMode={massSelectMode}
              selectedLogIds={selectedLogIds}
              onCardClick={openDeliverModal}
              onToggleSelect={toggleSelect}
              onTipClick={setTipEntry}
              onPayClick={openPay}
              onHideColumn={(key) => setHideTarget({ key, label: col.title })}
              onClaimAllTips={(person, ents) => setClaimAll({ person, entries: ents })}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOverColumn={handleDragOverColumn}
              onDropColumn={handleDropColumn}
            />
          ))}
        </div>
      )}

      {/* Deliver modal */}
      <div className={`pay-modal-overlay${deliverEntry ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 380 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title">Mark as Delivered</div>
            <button type="button" className="pdp-close-btn" onClick={closeDeliverModal}><span className="material-icons-outlined">close</span></button>
          </div>
          {deliverEntry && (
            <div className="pay-modal-body">
              <div className="pay-modal-info">
                <div className="pay-modal-customer">{deliverEntry.customerName}{deliverEntry.location ? ` — ${deliverEntry.location}` : ''}</div>
                <div className="pay-modal-debt" style={{ marginTop: 4 }}>
                  <span style={{ fontWeight: 600 }}>{deliverEntry.product} ×{deliverEntry.qty}</span> · {deliverEntry.time}
                </div>
              </div>
              <div className="pdp-field">
                <label className="pdp-label">Delivery Status</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="lb-status-btn lb-status-delivered" onClick={() => applyStatus('Delivered', 0)}>
                    <span className="material-icons-outlined">check_circle</span> Delivered
                  </button>
                  <button type="button" className="lb-status-btn lb-status-partial" onClick={() => setShowPartialQty(true)}>
                    <span className="material-icons-outlined">pie_chart</span> Partial
                  </button>
                  <button type="button" className="lb-status-btn lb-status-undelivered" onClick={() => applyStatus('Undelivered', 0)}>
                    <span className="material-icons-outlined">cancel</span> Undelivered
                  </button>
                </div>
              </div>
              {showPartialQty && (
                <div>
                  <label className="pdp-label">Qty Delivered <span style={{ color: 'var(--muted-fg)', fontWeight: 400 }}>(max {deliverEntry.qty - 1})</span></label>
                  <div className="pdp-qty-row">
                    <button type="button" className="qty-btn" onClick={() => setPartialQty((q) => Math.max(1, q - 1))}>−</button>
                    <input type="number" className="pdp-qty-input" value={partialQty} min={1} max={deliverEntry.qty - 1} onChange={(e) => setPartialQty(Math.min(deliverEntry.qty - 1, Math.max(1, Number(e.target.value) || 1)))} />
                    <button type="button" className="qty-btn" onClick={() => setPartialQty((q) => Math.min(deliverEntry.qty - 1, q + 1))}>+</button>
                  </div>
                  <button type="button" className="btn-primary" style={{ marginTop: 8, width: '100%' }} onClick={() => applyStatus('Partial', partialQty)}>
                    <span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>pie_chart</span> Confirm Partial
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tip modal */}
      <div className={`pay-modal-overlay${tipEntry ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 360 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title">{tipEntry?.tipClaimed ? 'Unclaim Tip' : 'Claim Tip'}</div>
            <button type="button" className="pdp-close-btn" onClick={() => setTipEntry(null)}><span className="material-icons-outlined">close</span></button>
          </div>
          {tipEntry && (
            <div className="pay-modal-body">
              <div className="pay-modal-info">
                <div className="pay-modal-customer">{tipEntry.customerName}{tipEntry.location ? ` — ${tipEntry.location}` : ''}</div>
                <div className="pay-modal-debt" style={{ marginTop: 4 }}>
                  <span style={{ fontWeight: 600 }}>Tip: {formatPeso(tipEntry.tip)}</span>
                  {tipEntry.tipClaimed && <span style={{ color: 'hsl(150,45%,32%)', fontWeight: 700 }}> · Already claimed</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn-cancel-delete" onClick={() => setTipEntry(null)}>Cancel</button>
                <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={confirmTip}>
                  <span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>{tipEntry.tipClaimed ? 'undo' : 'check_circle'}</span> {tipEntry.tipClaimed ? 'Mark as Unclaimed' : 'Mark as Claimed'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Claim all modal */}
      <div className={`pay-modal-overlay${claimAll ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 360 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title">Claim All Tips</div>
            <button type="button" className="pdp-close-btn" onClick={() => setClaimAll(null)}><span className="material-icons-outlined">close</span></button>
          </div>
          {claimAll && (
            <div className="pay-modal-body">
              <div className="pay-modal-info">
                <div className="pay-modal-customer">{claimAll.person || 'No Point Person'}</div>
                <div className="pay-modal-debt" style={{ marginTop: 4 }}>
                  <span style={{ fontWeight: 600 }}>{claimAll.entries.length} tip{claimAll.entries.length === 1 ? '' : 's'}</span> · Total {formatPeso(claimAll.entries.reduce((s, e) => s + e.tip, 0))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn-cancel-delete" onClick={() => setClaimAll(null)}>Cancel</button>
                <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={confirmClaimAll}>
                  <span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>check_circle</span> Claim All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hide column modal */}
      <div className={`pay-modal-overlay${hideTarget ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 340 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title">Hide Column</div>
            <button type="button" className="pdp-close-btn" onClick={() => setHideTarget(null)}><span className="material-icons-outlined">close</span></button>
          </div>
          {hideTarget && (
            <div className="pay-modal-body">
              <div className="pay-modal-info">
                <div className="pay-modal-customer">{hideTarget.label}</div>
                <div className="pay-modal-debt" style={{ marginTop: 4 }}>This column will be hidden from the board. You can unhide it anytime from the hidden columns bar.</div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn-cancel-delete" onClick={() => setHideTarget(null)}>Cancel</button>
                <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={() => { toggleHiddenColumn(hideTarget.key); showToast(`${hideTarget.label} column hidden.`, { type: 'success' }); setHideTarget(null); }}>
                  <span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>visibility_off</span> Hide Column
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Void modal */}
      <div className={`pay-modal-overlay${voidTarget ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 380 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title">Void Order</div>
            <button type="button" className="pdp-close-btn" onClick={() => setVoidTarget(null)}><span className="material-icons-outlined">close</span></button>
          </div>
          {voidTarget && (
            <div className="pay-modal-body">
              <div className="pay-modal-info">
                <div className="pay-modal-customer">{voidTarget.customerName}</div>
                <div className="pay-modal-debt" style={{ marginTop: 4 }}>
                  <span style={{ fontWeight: 600 }}>{voidTarget.product} ×{voidTarget.qty}</span> · Order {voidTarget.orderId}
                </div>
              </div>
              <div className="lb-void-warning">
                <span className="material-icons-outlined">warning</span>
                This permanently removes the order from Logbook, Commissions, CashDrawer, and Pautang, and marks it Void in Sales. Any outstanding utang tied to this order will be subtracted from the customer's balance. This cannot be undone.
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn-cancel-delete" onClick={() => setVoidTarget(null)}>Cancel</button>
                <button type="button" className="btn-destructive" style={{ flex: 1 }} onClick={confirmVoid}>
                  <span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>block</span> Confirm Void
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reassign modal */}
      <div className={`pay-modal-overlay${reassign ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 360 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title">Reassign Delivery</div>
            <button type="button" className="pdp-close-btn" onClick={() => setReassign(null)}><span className="material-icons-outlined">close</span></button>
          </div>
          {reassign && (
            <div className="pay-modal-body">
              <div className="pay-modal-info">
                <div className="pay-modal-customer">{reassign.isMass ? `${reassign.entries.length} orders selected` : reassign.entries[0].customerName}</div>
                <div className="pay-modal-debt" style={{ marginTop: 4 }}>
                  Reassign {reassign.isMass ? 'all' : ''} to <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{reassign.newPerson || 'No point person'}</span>?
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" className="btn-cancel-delete" onClick={() => setReassign(null)}>Cancel</button>
                <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={confirmReassign}>
                  <span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>swap_horiz</span> Confirm Reassign
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mass deliver confirm modal */}
      <div className={`pay-modal-overlay${massDeliverOpen ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 600 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title">Confirm Mark as Delivered</div>
            <button type="button" className="pdp-close-btn" onClick={() => setMassDeliverOpen(false)}><span className="material-icons-outlined">close</span></button>
          </div>
          <div className="pay-modal-body" style={{ padding: 0 }}>
            <div className="lb-confirm-summary">{selectedEntries.length} order{selectedEntries.length === 1 ? '' : 's'} will be marked as Delivered:</div>
            <div className="lb-confirm-header-row">
              <div className="lb-confirm-cell lb-confirm-cell-name">Name</div>
              <div className="lb-confirm-cell lb-confirm-cell-loc">Location</div>
              <div className="lb-confirm-cell lb-confirm-cell-prod">Product</div>
              <div className="lb-confirm-cell lb-confirm-cell-qty">Qty</div>
              <div className="lb-confirm-cell lb-confirm-cell-pay">Payment</div>
            </div>
            <div className="lb-confirm-list">
              {selectedEntries.map((e) => {
                const payStatus = String(e.paymentStatus || 'Paid').toLowerCase();
                return (
                  <div className="lb-confirm-row" key={e.logId}>
                    <div className="lb-confirm-cell lb-confirm-cell-name">{e.customerName || '—'}</div>
                    <div className="lb-confirm-cell lb-confirm-cell-loc">{e.location || '—'}</div>
                    <div className="lb-confirm-cell lb-confirm-cell-prod">{e.product || '—'}</div>
                    <div className="lb-confirm-cell lb-confirm-cell-qty">×{e.qty || 0}</div>
                    <div className="lb-confirm-cell lb-confirm-cell-pay">
                      {payStatus === 'partial' && <span className="lb-confirm-pay lb-confirm-pay-partial">{formatPeso(e.paymentBalance)} left</span>}
                      {payStatus !== 'paid' && payStatus !== 'partial' && <span className="lb-confirm-pay lb-confirm-pay-utang">{formatPeso(e.paymentBalance)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="lb-confirm-actions">
              <button type="button" className="btn-cancel-delete" onClick={() => setMassDeliverOpen(false)}>Cancel</button>
              <button type="button" className="btn-primary" style={{ flex: 1 }} onClick={confirmMassDeliver}>
                <span className="material-icons-outlined" style={{ fontSize: 16, verticalAlign: 'middle' }}>check_circle</span> Confirm Mark Delivered
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pay modal */}
      <div className={`pay-modal-overlay${payEntry ? ' show' : ''}`}>
        <div className="pay-modal">
          <div className="pay-modal-header">
            <div className="pay-modal-title">Record Payment</div>
            <button type="button" className="pdp-close-btn" onClick={() => setPayEntry(null)}><span className="material-icons-outlined">close</span></button>
          </div>
          {payEntry && (
            <div className="pay-modal-body">
              <div className="pay-modal-info">
                <div className="pay-modal-customer">{payEntry.customerName}</div>
                <div className="pay-modal-debt">Balance: <strong>{formatPeso(payDebt)}</strong></div>
              </div>
              <div className="pdp-field">
                <label className="pdp-label">Amount Paid</label>
                <div className="pdp-amount-row">
                  <input type="number" className="pdp-input" placeholder="0.00" min={0} max={payDebt} value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                  <button type="button" className="btn-exact" onClick={() => setPayAmount(String(payDebt))}>Exact</button>
                </div>
              </div>
              <div className="pdp-pay-method-row">
                <label className="pdp-pay-method-option">
                  <input type="radio" name="lbPayMethod" value="Cash" checked={payMethod === 'Cash'} onChange={() => setPayMethod('Cash')} />
                  <span className="material-icons-outlined">payments</span> Cash
                </label>
                <label className="pdp-pay-method-option">
                  <input type="radio" name="lbPayMethod" value="GCash" checked={payMethod === 'GCash'} onChange={() => setPayMethod('GCash')} />
                  <span className="material-icons-outlined">smartphone</span> GCash
                </label>
              </div>
              <button type="button" className="btn-primary" disabled={paySubmitting} onClick={confirmPay}>
                {paySubmitting ? 'Processing...' : 'Confirm Payment'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LogbookPage() {
  return (
    <RequireShift>
      <LogbookPageContent />
    </RequireShift>
  );
}