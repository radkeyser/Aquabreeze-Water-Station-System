import { useCallback, useEffect, useMemo, useState } from 'react';
import PautangCard from './PautangCard.jsx';
import {
  filterPautangClientSide,
  getDeliveryBoys,
  getMergedPautang,
  getShiftStatus,
  payPautang,
  updatePautangPointPerson,
} from '../../../src/api/pautang.js';
import { formatPeso } from '../../../src/utils/format.js';
import { showToast as notify } from '../../../src/utils/toast.js';
import './pautang.css';
import '../../../src/index.css';

const HIDDEN_KEY = 'pautangHiddenIds';
const SEARCH_KEY = 'pautangSearchQuery';
const PAGE_SIZE = 10;

function loadHiddenIds() {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
  } catch {
    return [];
  }
}

function loadSavedSearch() {
  try {
    return localStorage.getItem(SEARCH_KEY) || '';
  } catch {
    return '';
  }
}

function cardSearchMatch(credit, query) {
  const q = query.toLowerCase();
  return (
    String(credit.customerName || '').toLowerCase().includes(q)
    || String(credit.id || '').toLowerCase().includes(q)
    || String(credit.pointPerson || '').toLowerCase().includes(q)
    || String(credit.product || '').toLowerCase().includes(q)
    || String(credit.location || '').toLowerCase().includes(q)
  );
}

function sortCredits(credits, sortAlpha) {
  const list = [...credits];
  if (sortAlpha) {
    list.sort((a, b) => {
      const na = (a.customerName || '').toLowerCase();
      const nb = (b.customerName || '').toLowerCase();
      return na.localeCompare(nb);
    });
  } else {
    list.sort((a, b) => {
      const na = parseInt((String(a.id || '').match(/(\d+)$/) || [0, 0])[1], 10);
      const nb = parseInt((String(b.id || '').match(/(\d+)$/) || [0, 0])[1], 10);
      return nb - na;
    });
  }
  return list;
}

export default function PautangPage() {
  const [allData, setAllData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [shiftOpen, setShiftOpen] = useState(false);
  const [deliveryBoys, setDeliveryBoys] = useState([]);

  const [activeDate, setActiveDate] = useState('today');
  const [personFilter, setPersonFilter] = useState('');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showCustomDates, setShowCustomDates] = useState(false);
  const [sortAlpha, setSortAlpha] = useState(false);
  const [searchQuery, setSearchQuery] = useState(loadSavedSearch);
  const [hiddenIds, setHiddenIds] = useState(loadHiddenIds);
  const [expandedId, setExpandedId] = useState(null);
  const [page, setPage] = useState(1);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [breakdownModalOpen, setBreakdownModalOpen] = useState(false);
  const [breakdownCredit, setBreakdownCredit] = useState(null);
  const [payingOrderIds, setPayingOrderIds] = useState([]);
  const [payingDebt, setPayingDebt] = useState(0);
  const [payingCustomer, setPayingCustomer] = useState('');
  const [payingProduct, setPayingProduct] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [paySubmitting, setPaySubmitting] = useState(false);

  const [ppPopover, setPpPopover] = useState(null);
  const showToast = useCallback((message) => notify(message), []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, shift, boys] = await Promise.all([
        getMergedPautang(),
        getShiftStatus(),
        getDeliveryBoys(),
      ]);
      setAllData(data || []);
      setShiftOpen(!!shift?.isOpen);
      setDeliveryBoys(boys || []);
    } catch (err) {
      console.error('Pautang load error', err);
      setError(err?.message || 'Failed to load pautang data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const filteredData = useMemo(() => {
    const filtered = filterPautangClientSide(
      allData,
      activeDate,
      personFilter,
      customFrom,
      customTo
    );
    return filtered.filter((c) => String(c.chargeStatus || 'No').toLowerCase() !== 'yes');
  }, [allData, activeDate, personFilter, customFrom, customTo]);

  const sortedData = useMemo(
    () => sortCredits(filteredData, sortAlpha),
    [filteredData, sortAlpha]
  );

  const isSearching = !!searchQuery.trim();

  const searchFiltered = useMemo(() => {
    if (!isSearching) return sortedData;
    const q = searchQuery.trim().toLowerCase();
    return sortedData.filter((c) => cardSearchMatch(c, q));
  }, [sortedData, searchQuery, isSearching]);

  const totalOutstanding = useMemo(() => {
    if (isSearching) {
      return searchFiltered.reduce((s, c) => s + (Number(c.amount) || 0), 0);
    }
    return filteredData.reduce((s, c) => s + (Number(c.amount) || 0), 0);
  }, [filteredData, searchFiltered, isSearching]);

  const totalPages = Math.max(1, Math.ceil(searchFiltered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pageData = useMemo(() => {
    if (isSearching) return searchFiltered;
    const start = (currentPage - 1) * PAGE_SIZE;
    return searchFiltered.slice(start, start + PAGE_SIZE);
  }, [searchFiltered, isSearching, currentPage]);

  useEffect(() => {
    setPage(1);
  }, [activeDate, personFilter, customFrom, customTo, sortAlpha, searchQuery]);

  const saveHidden = useCallback((ids) => {
    setHiddenIds(ids);
    try {
      localStorage.setItem(HIDDEN_KEY, JSON.stringify(ids));
    } catch {
      // ignore
    }
  }, []);

  const toggleHide = useCallback((credit) => {
    const cardId = credit.id;
    setHiddenIds((prev) => {
      const idx = prev.indexOf(cardId);
      const next = idx === -1 ? [...prev, cardId] : prev.filter((id) => id !== cardId);
      try {
        localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const unhideAll = useCallback(() => {
    saveHidden([]);
    showToast('All hidden rows are now visible.');
  }, [saveHidden, showToast]);

  function handleDateTab(val) {
    setActiveDate(val);
    setShowCustomDates(val === 'custom');
    if (val !== 'custom') {
      setCustomFrom('');
      setCustomTo('');
    }
  }

  function applyCustomDates() {
    if (!customFrom || !customTo) {
      showToast('Please select both dates.');
      return;
    }
    setActiveDate('custom');
  }

  function openPayModal(orderIds, debt, customer, product) {
    setPayingOrderIds(Array.isArray(orderIds) ? orderIds : [orderIds]);
    setPayingDebt(debt);
    setPayingCustomer(customer);
    setPayingProduct(product || '');
    setPayAmount('');
    setPayMethod('Cash');
    setPayModalOpen(true);
    setBreakdownModalOpen(false);
  }

  function handlePayClick(orderIds, debt, customer, product, hasBreakdown, credit) {
    if (!shiftOpen) {
      showToast('Please open a shift first.');
      return;
    }
    if (hasBreakdown && credit) {
      setBreakdownCredit(credit);
      setBreakdownModalOpen(true);
      return;
    }
    openPayModal(orderIds, debt, customer, product);
  }

  async function confirmPayment() {
    const amount = parseFloat(payAmount) || 0;
    if (amount <= 0) {
      showToast('Please enter a valid amount.');
      return;
    }
    setPaySubmitting(true);
    try {
      const result = await payPautang(payingOrderIds, amount, payMethod);
      if (result?.success === false) throw new Error(result.message || 'Payment failed.');
      showToast(result?.message || 'Payment recorded!');
      setPayModalOpen(false);
      await reload();
    } catch (err) {
      if (err?.code === 'PGRST202') {
        showToast('Payment function not set up — run 003_pautang_rpc.sql in Supabase SQL Editor.');
      } else {
        showToast(err?.message || 'Payment failed.');
      }
    } finally {
      setPaySubmitting(false);
    }
  }

  function openPpPopover(orderIds, currentPP, anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    setPpPopover({
      orderIds,
      currentPP: currentPP || '',
      top: rect.bottom + 6,
      left: Math.min(rect.left, window.innerWidth - 280),
    });
  }

  async function savePointPerson(orderIds, newPP) {
    try {
      const result = await updatePautangPointPerson(orderIds, newPP);
      if (result?.success === false) throw new Error(result.message || 'Update failed.');
      showToast(result?.message || 'Point person updated.');
      setPpPopover(null);
      await reload();
    } catch (err) {
      showToast(err?.message || 'Update failed.');
    }
  }

  const paidAmount = parseFloat(payAmount) || 0;
  let payStatusClass = 'status-utang';
  let payStatusText = 'Enter amount';
  let payStatusIcon = 'schedule';
  if (paidAmount > 0 && paidAmount < payingDebt) {
    payStatusClass = 'status-partial';
    payStatusText = `Partial — ${formatPeso(payingDebt - paidAmount)} remaining`;
    payStatusIcon = 'pie_chart';
  } else if (paidAmount >= payingDebt && payingDebt > 0) {
    payStatusClass = 'status-paid';
    payStatusText = 'Fully Paid!';
    payStatusIcon = 'check_circle';
  }

  const rowCountLabel = `${searchFiltered.length} records`;

  return (
    <div className="pautang-page">
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-icon danger">
            <span className="material-icons-outlined">error_outline</span>
          </div>
          <div>
            <div className="summary-label">Total Outstanding</div>
            <div className="summary-value text-danger">{formatPeso(totalOutstanding)}</div>
          </div>
        </div>
      </div>

      {!shiftOpen && (
        <div className="shift-warning-banner">
          <span className="material-icons-outlined">lock_clock</span>
          No active shift — Pay buttons are disabled until a shift is opened.
        </div>
      )}

      <div className="pautang-filter-row">
        <div className="pautang-search-wrap">
          <span className="material-icons-outlined pautang-search-icon">search</span>
          <input
            type="text"
            className="search-input pautang-search-input"
            id="pautangSearch"
            placeholder="Search customer, order ID, product..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              try {
                localStorage.setItem(SEARCH_KEY, e.target.value);
              } catch {
                // ignore
              }
            }}
          />
          <button
            type="button"
            className="pautang-search-clear"
            id="pautangSearchClear"
            title="Clear search"
            style={{ display: searchQuery ? '' : 'none' }}
            onClick={() => {
              setSearchQuery('');
              try {
                localStorage.setItem(SEARCH_KEY, '');
              } catch {
                // ignore
              }
            }}
          >
            <span className="material-icons-outlined">close</span>
          </button>
        </div>

        <select
          className="filter-person-select"
          id="pautangPersonFilter"
          style={{ flexShrink: 0 }}
          value={personFilter}
          onChange={(e) => setPersonFilter(e.target.value)}
        >
          <option value="">All Delivery Boys</option>
          {deliveryBoys.map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>

        <button
          type="button"
          className={`filter-sort-btn${sortAlpha ? ' filter-sort-btn-active' : ''}`}
          id="pautangSortBtn"
          title={sortAlpha ? 'Sort: Newest first' : 'Toggle A→Z sort'}
          onClick={() => setSortAlpha((v) => !v)}
        >
          <span className="material-icons-outlined">sort_by_alpha</span>
        </button>

        <button
          type="button"
          className="filter-sort-btn pautang-unhide-all-btn"
          id="pautangUnhideAllBtn"
          title="Unhide all hidden rows"
          style={{ display: hiddenIds.length ? '' : 'none' }}
          onClick={unhideAll}
        >
          <span className="material-icons-outlined">visibility</span>
          <span className="pautang-unhide-count" id="pautangUnhideAllCount">{hiddenIds.length}</span>
        </button>

        <div className="filter-tabs" id="pautangDateTabs" style={{ flexShrink: 0 }}>
          {['today', 'week', 'month', 'all', 'custom'].map((val) => (
            <button
              key={val}
              type="button"
              className={`filter-tab${activeDate === val ? ' active' : ''}`}
              data-val={val}
              onClick={() => handleDateTab(val)}
            >
              {val === 'today' ? 'Today' : val === 'week' ? 'Week' : val === 'month' ? 'Month' : val === 'all' ? 'All' : 'Custom'}
            </button>
          ))}
        </div>
      </div>

      {showCustomDates && (
        <div className="filter-custom-dates" id="pautangCustomDates">
          <div className="filter-date-group">
            <label className="filter-date-label">From</label>
            <input
              type="date"
              className="filter-date-input"
              id="pautangDateFrom"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
          </div>
          <span className="filter-date-sep">→</span>
          <div className="filter-date-group">
            <label className="filter-date-label">To</label>
            <input
              type="date"
              className="filter-date-input"
              id="pautangDateTo"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
          </div>
          <button type="button" className="btn-apply-dates" id="pautangApplyDates" onClick={applyCustomDates}>
            Apply
          </button>
        </div>
      )}

      <div className="pautang-card-wrap card" id="pautangCard">
        <div className="card-header">
          <div className="card-title">
            <span className="material-icons-outlined">payments</span>
            Credit Ledger
            <span className="pautang-row-count" id="pautangRowCount">{rowCountLabel}</span>
          </div>
        </div>

        <div className="pc-list" id="pautangLedgerBody">
          {loading && (
            <div className="pautang-loading">
              <div className="loader" />
              <p>Loading...</p>
            </div>
          )}
          {!loading && error && (
            <div className="pautang-empty-state">
              <p>{error}</p>
              <button type="button" className="btn-primary" style={{ width: 'auto', marginTop: 12 }} onClick={reload}>
                Retry
              </button>
            </div>
          )}
          {!loading && !error && pageData.length === 0 && (
            <div className="pautang-empty-state"><p>No records found</p></div>
          )}
          {!loading && !error && pageData.map((credit) => (
            <PautangCard
              key={`${credit.id}-${credit.date}-${credit.product}`}
              credit={credit}
              shiftOpen={shiftOpen}
              hidden={hiddenIds.includes(credit.id)}
              expanded={expandedId === credit.id}
              onToggleExpand={(id) => setExpandedId((cur) => (cur === id ? null : id))}
              onToggleHide={toggleHide}
              onPay={handlePayClick}
              onEditPointPerson={openPpPopover}
            />
          ))}
        </div>

        {!isSearching && !loading && searchFiltered.length > PAGE_SIZE && (
          <div className="pautang-paginator" id="pg-pautang">
            <button type="button" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={n === currentPage ? 'active' : ''}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
            <button type="button" disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
          </div>
        )}
      </div>

      {/* Pay modal */}
      <div className={`pay-modal-overlay${payModalOpen ? ' show' : ''}`} id="payModalOverlay">
        <div className="pay-modal pautang-pay-modal">
          <div className="pay-modal-header">
            <div className="pay-modal-title">Record Payment</div>
            <button type="button" className="pdp-close-btn" id="payModalClose" onClick={() => setPayModalOpen(false)}>
              <span className="material-icons-outlined">close</span>
            </button>
          </div>
          <div className="pay-modal-body">
            <div className="pay-modal-info">
              <div className="pay-modal-customer" id="payModalCustomer">{payingCustomer || '—'}</div>
              {payingProduct && (
                <div id="payModalProduct" style={{ fontSize: 13, color: 'hsl(var(--muted-fg))', marginBottom: 2 }}>
                  {payingProduct}
                </div>
              )}
              <div className="pay-modal-debt">
                Balance: <strong id="payModalDebt">{formatPeso(payingDebt)}</strong>
              </div>
            </div>
            <div className="pdp-field">
              <label className="pdp-label">Amount Paid</label>
              <div className="pdp-amount-row">
                <input
                  type="number"
                  className="pdp-input"
                  id="payModalAmount"
                  placeholder="0.00"
                  min="0"
                  max={payingDebt}
                  value={payAmount}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (Number.isFinite(val) && val > payingDebt) {
                      setPayAmount(String(payingDebt));
                    } else {
                      setPayAmount(e.target.value);
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-exact"
                  id="payModalExact"
                  onClick={() => setPayAmount(String(payingDebt))}
                >
                  Exact
                </button>
              </div>
            </div>
            <div className="pdp-pay-method-row">
              <label className="pdp-pay-method-option">
                <input type="radio" name="payModalMethod" value="Cash" checked={payMethod === 'Cash'} onChange={() => setPayMethod('Cash')} />
                <span className="material-icons-outlined">payments</span> Cash
              </label>
              <label className="pdp-pay-method-option">
                <input type="radio" name="payModalMethod" value="GCash" checked={payMethod === 'GCash'} onChange={() => setPayMethod('GCash')} />
                <span className="material-icons-outlined">smartphone</span> GCash
              </label>
            </div>
            <div className={`pdp-status-pill ${payStatusClass}`} id="payModalStatus">
              <span className="material-icons-outlined">{payStatusIcon}</span>
              <span id="payModalStatusText">{payStatusText}</span>
            </div>
            <button
              type="button"
              className="btn-primary"
              id="payModalConfirm"
              disabled={paySubmitting}
              onClick={confirmPayment}
            >
              {paySubmitting ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      </div>

      {/* Breakdown pay modal */}
      <div className={`pay-modal-overlay${breakdownModalOpen ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 520 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title">
              {breakdownCredit?.customerName || 'Customer'} — Order Breakdown
            </div>
            <button type="button" className="pdp-close-btn" onClick={() => setBreakdownModalOpen(false)}>
              <span className="material-icons-outlined">close</span>
            </button>
          </div>
          <div className="pay-modal-body" style={{ padding: 0, overflow: 'hidden' }}>
            {(breakdownCredit?.orders || []).map((o) => {
              const oProd = o.product + (o.slimPoly && o.product === '5 Gallon' ? ` (${o.slimPoly})` : '');
              return (
                <div key={o.id} className="order-card">
                  <div className="order-card-header">
                    <div className="order-card-left">
                      <div className="order-card-id">{o.id}</div>
                      <div style={{ fontSize: 12, color: 'hsl(var(--muted-fg))', marginTop: 2 }}>
                        {oProd} · x {o.qty}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge ${String(o.status).toLowerCase() === 'paid' ? 'badge-success' : String(o.status).toLowerCase() === 'partial' ? 'badge-warning' : 'badge-danger'}`}>
                        {o.status}
                      </span>
                      {shiftOpen && o.amount > 0 && (
                        <button
                          type="button"
                          className="pay-btn breakdown-sub-pay-btn"
                          onClick={() => openPayModal([o.id], o.amount, breakdownCredit.customerName, `${oProd} x ${o.qty}`)}
                        >
                          <span className="material-icons-outlined">payments</span> Pay
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="order-card-details">
                    <div className="order-card-detail">
                      <div className="order-detail-label">Order Total</div>
                      <div className="order-detail-val">{formatPeso(o.orderTotal)}</div>
                    </div>
                    <div className="order-card-detail">
                      <div className="order-detail-label">Already Paid</div>
                      <div className="order-detail-val text-success">{formatPeso(o.alreadyPaid)}</div>
                    </div>
                    <div className="order-card-detail">
                      <div className="order-detail-label">Balance</div>
                      <div className="order-detail-val text-danger text-bold">{formatPeso(o.amount)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Point person popover */}
      {ppPopover && (
        <>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 599 }}
            onClick={() => setPpPopover(null)}
          />
          <div
            className="pc-pp-popover"
            style={{ top: ppPopover.top, left: ppPopover.left }}
          >
            <div className="pc-pp-pop-label">Reassign point person</div>
            <select
              className="pc-pp-pop-select"
              defaultValue={ppPopover.currentPP}
              id="ppPopSelect"
            >
              <option value="">— No point person —</option>
              {deliveryBoys.map((b) => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
            <div className="pc-pp-pop-actions">
              <button type="button" className="pc-pp-pop-cancel" onClick={() => setPpPopover(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => {
                  const sel = document.getElementById('ppPopSelect');
                  savePointPerson(ppPopover.orderIds, sel?.value || '');
                }}
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
