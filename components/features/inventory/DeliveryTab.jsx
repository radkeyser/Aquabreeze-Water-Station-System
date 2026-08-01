import { useEffect, useMemo, useState } from 'react';
import { getDeliveryHistory, saveDelivery, getActiveShiftId, INV_BAG_SIZES, fmtNum } from '../../../src/api/inventory.js';
import { formatPeso } from '../../../src/utils/format.js';
import { showToast as notify } from '../../../src/utils/toast.js';

const PRODUCTS = ['500 mL', '1000 mL', 'Slim Gallon'];

export default function DeliveryTab() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [shiftOpen, setShiftOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [productFilter, setProductFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [step, setStep] = useState('form'); // form | confirm
  const [detailRec, setDetailRec] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [product, setProduct] = useState('');
  const [supplier, setSupplier] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [bags, setBags] = useState('');
  const [discount, setDiscount] = useState('0');
  const [additional, setAdditional] = useState('0');
  const [mop, setMop] = useState('');
  const [notes, setNotes] = useState('');

  const showToast = (m) => notify(m);

  const load = async () => {
    setLoading(true);
    try {
      const [hist, shiftId] = await Promise.all([getDeliveryHistory(), getActiveShiftId()]);
      setRecords(hist.records);
      setSuppliers(hist.suppliers);
      setShiftOpen(!!shiftId);
    } catch { showToast('Failed to load deliveries.'); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  function resetForm() {
    setProduct(''); setSupplier(''); setDate(new Date().toISOString().split('T')[0]);
    setBags(''); setDiscount('0'); setAdditional('0'); setMop(''); setNotes('');
    setStep('form');
  }
  function openForm() {
    if (!shiftOpen) { showToast('Please open a shift first.'); return; }
    resetForm();
    setFormOpen(true);
  }

  const supplierOptions = useMemo(() => suppliers.filter((s) => s.products[product]), [suppliers, product]);
  const supplierObj = useMemo(() => suppliers.find((s) => s.name === supplier), [suppliers, supplier]);
  const prodData = supplierObj ? supplierObj.products[product] : null;
  const unitPrice = prodData ? prodData.price : 0;
  const ppb = prodData ? prodData.qty : (INV_BAG_SIZES[product] || 1);
  const bagsNum = parseFloat(bags) || 0;
  const subtotal = unitPrice * bagsNum;
  const discountNum = parseFloat(discount) || 0;
  const additionalNum = parseFloat(additional) || 0;
  const totalCost = subtotal - discountNum + additionalNum;

  function getDateRange(tf) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    if (tf === 'today') return { from: today, to: today };
    if (tf === 'week') { const w = new Date(now); w.setDate(now.getDate() - 6); return { from: w.toISOString().split('T')[0], to: today }; }
    if (tf === 'month') { const m = new Date(now.getFullYear(), now.getMonth(), 1); return { from: m.toISOString().split('T')[0], to: today }; }
    return null;
  }

  const filtered = useMemo(() => {
    let from = '', to = '';
    if (dateFilter === 'custom') { from = customFrom; to = customTo; }
    else if (dateFilter !== 'all') { const r = getDateRange(dateFilter); if (r) { from = r.from; to = r.to; } }
    const q = search.toLowerCase();
    return records.filter((r) => {
      const text = Object.values(r).join(' ').toLowerCase();
      const inRange = (!from || r.date >= from) && (!to || r.date <= to);
      return (!q || text.includes(q))
        && (!supplierFilter || r.supplier.toLowerCase() === supplierFilter)
        && (!productFilter || r.product.toLowerCase() === productFilter)
        && inRange;
    });
  }, [records, search, supplierFilter, productFilter, dateFilter, customFrom, customTo]);

  async function handleSave() {
    setSubmitting(true);
    try {
      const payload = { date, supplier, product, bags: bagsNum, piecePerBag: ppb, discount: discountNum, additional: additionalNum, mop, notes, totalCost, unitPrice };
      const res = await saveDelivery(payload);
      if (res.success) {
        showToast('Delivery recorded!');
        setFormOpen(false);
        await load();
      } else showToast('Error: ' + res.message);
    } catch (err) { showToast('Error: ' + (err?.message || 'Unknown')); }
    setSubmitting(false);
  }

  if (loading) return <div style={{ padding: '80px 0', textAlign: 'center' }}><div className="spinner" /></div>;

  return (
    <div>
      <div className="inv-page-header inv-page-header-row">
        <div>
          <div className="inv-page-title"><span className="material-icons-outlined">local_shipping</span> Delivery Records</div>
          <div className="inv-page-sub">{records.length} total record{records.length !== 1 ? 's' : ''}</div>
        </div>
        <button type="button" className="inv-btn-primary" disabled={!shiftOpen} style={!shiftOpen ? { opacity: 0.5, cursor: 'not-allowed' } : {}} onClick={openForm}>
          <span className="material-icons-outlined">add</span> Record Delivery
        </button>
      </div>

      <div className="inv-filters-row">
        <input type="text" className="search-input" placeholder="Search..." style={{ flex: 1, minWidth: 140 }} value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="filter-person-select" value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
          <option value="">All Suppliers</option>
          {suppliers.map((s) => <option key={s.id} value={s.name.toLowerCase()}>{s.name}</option>)}
        </select>
        <select className="filter-person-select" value={productFilter} onChange={(e) => setProductFilter(e.target.value)}>
          <option value="">All Products</option>
          {PRODUCTS.map((p) => <option key={p} value={p.toLowerCase()}>{p}</option>)}
        </select>
        <select className="filter-person-select" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}>
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      {dateFilter === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: 'var(--muted-fg)', fontWeight: 600 }}>From</label>
          <input type="date" className="pdp-input" style={{ width: 160 }} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <label style={{ fontSize: 13, color: 'var(--muted-fg)', fontWeight: 600 }}>To</label>
          <input type="date" className="pdp-input" style={{ width: 160 }} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
        </div>
      )}

      <div className="card"><div className="card-body" style={{ overflowX: 'auto', padding: 20 }}>
        <table className="data-table">
          <thead><tr>
            <th style={{ textAlign: 'center' }}>Date</th><th style={{ textAlign: 'center' }}>Supplier</th>
            <th style={{ textAlign: 'center' }}>Product</th><th style={{ textAlign: 'center' }}>Pcs/Bag</th>
            <th style={{ textAlign: 'center' }}>Bags</th><th style={{ textAlign: 'center' }}>Bottles</th>
            <th style={{ textAlign: 'center' }}>Subtotal</th><th style={{ textAlign: 'center' }}>Discount</th>
            <th style={{ textAlign: 'center' }}>Additional</th><th style={{ textAlign: 'center' }}>Total</th>
            <th style={{ textAlign: 'center' }}>MOP</th><th style={{ textAlign: 'center' }}>Notes</th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={12} style={{ textAlign: 'center', padding: 48, color: 'var(--muted-fg)' }}>No delivery records yet.</td></tr>
            ) : filtered.map((r) => {
              const rppb = r.piecePerBag || INV_BAG_SIZES[r.product] || 1;
              const btl = r.bags * rppb;
              const sub = r.totalCost > 0 ? r.totalCost + r.discount - r.additional : 0;
              return (
                <tr key={r.id} className="inv-clickable-row" onClick={() => setDetailRec(r)}>
                  <td><div>{r.date}</div><div className="inv-time">{r.time}</div></td>
                  <td className="text-bold">{r.supplier}</td>
                  <td>{r.product}</td>
                  <td style={{ textAlign: 'center', color: 'var(--muted-fg)' }}>{rppb > 1 ? rppb : '--'}</td>
                  <td style={{ textAlign: 'center' }}>{r.bags}</td>
                  <td style={{ textAlign: 'center', color: 'var(--muted-fg)' }}>{fmtNum(btl)}</td>
                  <td style={{ textAlign: 'right' }}>{sub > 0 ? formatPeso(sub) : '--'}</td>
                  <td style={{ textAlign: 'right', color: 'var(--destructive)' }}>{r.discount > 0 ? formatPeso(r.discount) : '--'}</td>
                  <td style={{ textAlign: 'right', color: 'hsl(38,65%,38%)' }}>{r.additional > 0 ? formatPeso(r.additional) : '--'}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>{r.totalCost > 0 ? formatPeso(r.totalCost) : '--'}</td>
                  <td><span className="inv-mop-badge">{r.mop || '--'}</span></td>
                  <td style={{ color: 'var(--muted-fg)', fontSize: 12, maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.notes}>{r.notes || '--'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div></div>

      {/* Add Delivery modal */}
      <div className={`pay-modal-overlay${formOpen ? ' show' : ''}`}>
        <div className="pay-modal inv-delivery-modal">
          <div className="pay-modal-header">
            <div className="pay-modal-title"><span className="material-icons-outlined" style={{ verticalAlign: 'middle', marginRight: 6, fontSize: 18 }}>local_shipping</span>Record Delivery</div>
            <button type="button" className="pdp-close-btn" onClick={() => setFormOpen(false)}><span className="material-icons-outlined">close</span></button>
          </div>
          <div className="pay-modal-body inv-delivery-modal-body">
            {step === 'form' ? (
              <>
                <div className="pdp-field">
                  <label className="pdp-label">Product <span style={{ color: 'var(--destructive)' }}>*</span></label>
                  <select className="pdp-select" value={product} onChange={(e) => { setProduct(e.target.value); setSupplier(''); }}>
                    <option value="">Select product first...</option>
                    {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {product && (
                  <div className="pdp-field">
                    <label className="pdp-label">Supplier <span style={{ color: 'var(--destructive)' }}>*</span></label>
                    <select className="pdp-select" value={supplier} onChange={(e) => setSupplier(e.target.value)}>
                      <option value="">Select supplier...</option>
                      {supplierOptions.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                )}
                {supplier && (
                  <>
                    <div className="pdp-field">
                      <label className="pdp-label">Date <span style={{ color: 'var(--destructive)' }}>*</span></label>
                      <input type="date" className="pdp-input" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    <div className="pdp-field">
                      <label className="pdp-label">{product === 'Slim Gallon' ? 'Quantity (pcs)' : 'Quantity (Bags)'} <span style={{ color: 'var(--destructive)' }}>*</span></label>
                      <input type="number" className="pdp-input" placeholder="0" min="0" value={bags} onChange={(e) => setBags(e.target.value)} />
                      <div className="inv-btl-calc">
                        {product === 'Slim Gallon' ? (bagsNum ? `= ${bagsNum} gallon(s)` : '') : (ppb && bagsNum ? `= ${bagsNum * ppb} bottles` : '')}
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div className="pdp-field">
                        <label className="pdp-label">Discount <span style={{ color: 'var(--muted-fg)', fontWeight: 400 }}>(optional)</span></label>
                        <input type="number" className="pdp-input" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                      </div>
                      <div className="pdp-field">
                        <label className="pdp-label">Additional <span style={{ color: 'var(--muted-fg)', fontWeight: 400 }}>(optional)</span></label>
                        <input type="number" className="pdp-input" min="0" step="0.01" value={additional} onChange={(e) => setAdditional(e.target.value)} />
                      </div>
                    </div>
                    {supplierObj && prodData && bagsNum > 0 && (
                      <div className="pdp-field">
                        <div className="inv-delivery-price-card">
                          <div className="inv-dpc-row"><span className="inv-dpc-label">Price per unit</span><span className="inv-dpc-val">{formatPeso(unitPrice)} / {product === 'Slim Gallon' ? 'pc' : 'bag'}{ppb > 1 ? ` (${ppb} pcs/bag)` : ''}</span></div>
                          <div className="inv-dpc-row"><span className="inv-dpc-label">Subtotal</span><span className="inv-dpc-val">{formatPeso(subtotal)}</span></div>
                          {discountNum > 0 && <div className="inv-dpc-row"><span className="inv-dpc-label">− Discount</span><span className="inv-dpc-val" style={{ color: 'var(--destructive)' }}>{formatPeso(discountNum)}</span></div>}
                          {additionalNum > 0 && <div className="inv-dpc-row"><span className="inv-dpc-label">+ Additional</span><span className="inv-dpc-val" style={{ color: 'hsl(38,65%,38%)' }}>{formatPeso(additionalNum)}</span></div>}
                          <div className="inv-dpc-row inv-dpc-total"><span className="inv-dpc-label">Total Cost</span><span className="inv-dpc-val inv-dpc-total-val">{formatPeso(totalCost)}</span></div>
                        </div>
                      </div>
                    )}
                    <div className="pdp-field">
                      <label className="pdp-label">Method of Payment <span style={{ color: 'var(--destructive)' }}>*</span></label>
                      <select className="pdp-select" value={mop} onChange={(e) => setMop(e.target.value)}>
                        <option value="">Select MOP...</option><option>Cash</option><option>BDO</option>
                      </select>
                    </div>
                    <div className="pdp-field">
                      <label className="pdp-label">Notes <span style={{ color: 'var(--muted-fg)', fontWeight: 400 }}>(optional)</span></label>
                      <textarea className="pdp-input" rows={2} style={{ resize: 'vertical', minHeight: 60 }} value={notes} onChange={(e) => setNotes(e.target.value)} />
                    </div>
                    <button
                      type="button" className="inv-btn-primary" style={{ width: '100%', marginTop: 4 }}
                      onClick={() => {
                        if (!date) { showToast('Please enter a date.'); return; }
                        if (!bagsNum) { showToast('Please enter quantity.'); return; }
                        if (!mop) { showToast('Please select MOP.'); return; }
                        setStep('confirm');
                      }}
                    >
                      <span className="material-icons-outlined">preview</span> Review
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                <div className="inv-confirm-grid" style={{ marginBottom: 16 }}>
                  <ConfRow label="Date" val={date} />
                  <ConfRow label="Supplier" val={supplier} />
                  <ConfRow label="Product" val={product} />
                  <ConfRow label={product === 'Slim Gallon' ? 'Quantity' : 'Bags'} val={product === 'Slim Gallon' ? `${bagsNum} gal` : `${bagsNum} bags`} />
                  {product !== 'Slim Gallon' && <ConfRow label="Bottles" val={`${bagsNum * ppb} bottles`} />}
                  <ConfRow label="Subtotal" val={formatPeso(subtotal)} />
                  {discountNum > 0 && <ConfRow label="− Discount" val={formatPeso(discountNum)} />}
                  {additionalNum > 0 && <ConfRow label="+ Additional" val={formatPeso(additionalNum)} />}
                  <ConfRow label="Total Cost" val={formatPeso(totalCost)} bold />
                  <ConfRow label="MOP" val={mop} />
                  <ConfRow label="Notes" val={notes || '--'} />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" className="inv-btn-ghost" style={{ flex: 1 }} onClick={() => setStep('form')}>
                    <span className="material-icons-outlined">arrow_back</span> Back
                  </button>
                  <button type="button" className="inv-btn-primary" style={{ flex: 2 }} disabled={submitting} onClick={handleSave}>
                    <span className="material-icons-outlined">save</span> {submitting ? 'Saving...' : 'Save Delivery'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Detail modal */}
      <div className={`pay-modal-overlay${detailRec ? ' show' : ''}`}>
        <div className="pay-modal" style={{ maxWidth: 380 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title">Delivery Details</div>
            <button type="button" className="pdp-close-btn" onClick={() => setDetailRec(null)}><span className="material-icons-outlined">close</span></button>
          </div>
          {detailRec && (
            <div className="pay-modal-body">
              <div className="inv-confirm-grid">
                <ConfRow label="ID" val={detailRec.id} />
                <ConfRow label="Date" val={detailRec.date} />
                <ConfRow label="Time" val={detailRec.time || '--'} />
                <ConfRow label="Supplier" val={detailRec.supplier} />
                <ConfRow label="Product" val={detailRec.product} />
                <ConfRow label="Bags" val={detailRec.bags} />
                <ConfRow label="Pcs/Bag" val={detailRec.piecePerBag > 1 ? detailRec.piecePerBag : '--'} />
                <ConfRow label="Bottles" val={fmtNum(detailRec.bags * (detailRec.piecePerBag || INV_BAG_SIZES[detailRec.product] || 1))} />
                {detailRec.discount > 0 && <ConfRow label="Discount" val={formatPeso(detailRec.discount)} />}
                {detailRec.additional > 0 && <ConfRow label="Additional" val={formatPeso(detailRec.additional)} />}
                <ConfRow label="Total Cost" val={detailRec.totalCost > 0 ? formatPeso(detailRec.totalCost) : '--'} bold />
                <ConfRow label="MOP" val={detailRec.mop} />
                <ConfRow label="Notes" val={detailRec.notes || '--'} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfRow({ label, val, bold }) {
  return (
    <div className={`inv-conf-row${bold ? ' inv-conf-bold' : ''}`}>
      <span className="inv-conf-label">{label}</span><span className="inv-conf-val">{val}</span>
    </div>
  );
}