import { useEffect, useState } from 'react';
import { getDailyInventoryFormData, saveDailyInventory, INV_PRODUCTS, INV_BAG_SIZES, fmtNum } from '../../../src/api/inventory.js';
import { showToast as notify } from '../../../src/utils/toast.js';

function ConfRow({ label, val, bold }) {
  return (
    <div className={`inv-conf-row${bold ? ' inv-conf-bold' : ''}`}>
      <span className="inv-conf-label">{label}</span><span className="inv-conf-val">{val}</span>
    </div>
  );
}

export default function DailyCountTab() {
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState(null);
  const [values, setValues] = useState({}); // { 'prod_actualBag': '', ... }
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const showToast = (m) => notify(m);

  useEffect(() => {
    getDailyInventoryFormData().then((d) => { setFormData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  function setVal(key, v) { setValues((prev) => ({ ...prev, [key]: v })); }
  function getVal(key) { return parseFloat(values[key]) || 0; }

  if (loading) return <div style={{ padding: '80px 0', textAlign: 'center' }}><div className="spinner" /></div>;
  if (!formData) return <div className="empty-state" style={{ padding: 48 }}>Error loading form.</div>;

  const products = {};
  INV_PRODUCTS.forEach((prod) => {
    const bagSize = INV_BAG_SIZES[prod];
    const isSlim = prod === 'Slim Gallon';
    const prev = formData.previous[prod] || {};
    const begBag = isSlim ? (prev.totalActual || 0) : (prev.actualBag || 0);
    const begBtl = prev.actualBottles || 0;
    const delBag = formData.deliveries[prod] || 0;
    const salesBtl = formData.sales[prod] || 0;
    const slimBorrow = isSlim ? (formData.borrowed['Slim Gallon'] || {}) : {};
    const borrowed = isSlim ? (slimBorrow.borrow || 0) : 0;
    const returned = isSlim ? (slimBorrow.returned || 0) : 0;

    const actBag = isSlim ? 0 : getVal(`${prod}_actualBag`);
    const actBtl = getVal(`${prod}_actualBtl`);

    let available, expected, totalActual;
    if (isSlim) {
      available = begBag + delBag;
      expected = available - salesBtl - borrowed + returned;
      totalActual = actBtl;
    } else {
      available = begBag * bagSize + begBtl + delBag;
      expected = available - salesBtl;
      totalActual = actBag * bagSize + actBtl;
    }
    const variance = totalActual - expected;

    products[prod] = { bagSize, isSlim, begBag, begBtl, delBag, salesBtl, borrowed, returned, actBag, actBtl, available, expected, totalActual, variance };
  });

  function allFilled() {
    return INV_PRODUCTS.every((p) => {
      if (p === 'Slim Gallon') return values[`${p}_actualBtl`] !== undefined && values[`${p}_actualBtl`] !== '';
      return values[`${p}_actualBag`] !== undefined && values[`${p}_actualBag`] !== '' && values[`${p}_actualBtl`] !== undefined && values[`${p}_actualBtl`] !== '';
    });
  }

  function handleReview() {
    if (!allFilled()) { showToast('Please fill in all Actual Ending fields.'); return; }
    setReviewing(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    const payload = { date: formData.date, products: {} };
    INV_PRODUCTS.forEach((p) => {
      const d = products[p];
      payload.products[p] = {
        begBag: d.begBag, begBtl: d.isSlim ? 0 : d.begBtl, delBag: d.delBag, salesBtl: d.salesBtl,
        borrowed: d.borrowed, returned: d.returned, available: d.available, expected: d.expected,
        actualBag: d.isSlim ? 0 : d.actBag, actualBtl: d.actBtl, totalActual: d.totalActual,
        variance: d.variance, bagSize: d.bagSize,
      };
    });
    try {
      const res = await saveDailyInventory(payload);
      if (res.success) {
        showToast('Inventory saved!');
        setValues({});
        setReviewing(false);
        setLoading(true);
        const fresh = await getDailyInventoryFormData();
        setFormData(fresh);
        setLoading(false);
      } else {
        showToast('Error: ' + res.message);
      }
    } catch (err) {
      showToast('Error: ' + (err?.message || 'Unknown'));
    } finally {
      setSubmitting(false);
    }
  }

  if (reviewing) {
    return (
      <div>
        <div className="inv-page-header inv-page-header-row">
          <div>
            <div className="inv-page-title"><span className="material-icons-outlined">preview</span> Review Inventory Count</div>
            <div className="inv-page-sub">{formData.date}</div>
          </div>
        </div>
        {INV_PRODUCTS.map((p) => {
          const d = products[p];
          const cls = d.variance < 0 ? 'inv-neg' : d.variance > 0 ? 'inv-pos' : 'inv-zero';
          const unit = d.isSlim ? 'gal' : 'btl';
          return (
            <div className="inv-confirm-card" key={p}>
              <div className="inv-confirm-card-title">{p}</div>
              <div className="inv-confirm-grid">
                {d.isSlim ? (
                  <>
                    <ConfRow label="Beg. Inv. (Gallon)" val={`${d.begBag} gal`} />
                    <ConfRow label="+ Delivery (Gallon)" val={`${d.delBag} gal`} />
                    <ConfRow label="Available for Sale" val={`${d.available} gal`} bold />
                    <ConfRow label="− Sales (Gallon)" val={`${d.salesBtl} gal`} />
                    <ConfRow label="− Borrowed (Gallon)" val={`${d.borrowed} gal`} />
                    <ConfRow label="+ Returned (Gallon)" val={`${d.returned} gal`} />
                    <ConfRow label="Expected Ending" val={`${d.expected} gal`} bold />
                    <ConfRow label="Actual Ending (Gallon)" val={`${d.actBtl} gal`} />
                    <ConfRow label="Total Actual Ending" val={`${d.totalActual} gal`} bold />
                  </>
                ) : (
                  <>
                    <ConfRow label="Beg. Inv. (Bags)" val={`${d.begBag} bags`} />
                    <ConfRow label="Beg. Inv. (Bottles)" val={`${d.begBtl} btl`} />
                    <ConfRow label="+ Delivery (Bottles)" val={`${d.delBag} btl`} />
                    <ConfRow label="Available for Sale" val={`${d.available} btl`} bold />
                    <ConfRow label="− Sales" val={`${d.salesBtl} btl`} />
                    <ConfRow label="Expected Ending" val={`${d.expected} btl`} bold />
                    <ConfRow label="Actual Ending (Bags)" val={`${d.actBag} bags`} />
                    <ConfRow label="Actual Ending (Btl)" val={`${d.actBtl} btl`} />
                    <ConfRow label="Total Actual Ending" val={`${d.totalActual} btl`} bold />
                  </>
                )}
              </div>
              <div className={`inv-variance-summary ${d.variance < 0 ? 'inv-vsum-neg' : d.variance === 0 ? 'inv-vsum-zero' : 'inv-vsum-pos'}`}>
                <span className="inv-vsum-label">Variance</span>
                <span className={`inv-vsum-val ${cls}`}>{d.variance >= 0 ? '+' : ''}{d.variance} {unit === 'gal' ? 'gallons' : 'bottles'}</span>
              </div>
            </div>
          );
        })}
        <div className="inv-page-footer">
          <button type="button" className="inv-btn-ghost" onClick={() => setReviewing(false)}><span className="material-icons-outlined">arrow_back</span> Back</button>
          <button type="button" className="inv-btn-primary" disabled={submitting} onClick={handleSubmit}>
            <span className="material-icons-outlined">check_circle</span> {submitting ? 'Saving...' : 'Submit Inventory'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="inv-page-header inv-page-header-row">
        <div>
          <div className="inv-page-title"><span className="material-icons-outlined">fact_check</span> Daily Inventory Count</div>
          <div className="inv-page-sub">{formData.date}</div>
        </div>
      </div>

      {INV_PRODUCTS.map((prod) => {
        const bagSize = INV_BAG_SIZES[prod];
        const d = products[prod];
        const isSlim = d.isSlim;

        return (
          <div className="inv-daily-card" key={prod}>
            <div className="inv-daily-card-head">
              <span className="material-icons-outlined" style={{ color: 'var(--primary)' }}>water_drop</span>
              <span className="inv-daily-prod-name">{prod}</span>
              {bagSize > 1 && <span className="inv-pc-badge">{bagSize} pcs/bag</span>}
            </div>
            <div className="inv-daily-cols">
              <div className="inv-daily-col">
                <div className="inv-col-head inv-col-head-auto"><span className="material-icons-outlined">auto_awesome</span> Auto-filled</div>
                {isSlim ? (
                  <>
                    <AutoField label="Beg. Inv. (Gallon)" value={`${fmtNum(d.begBag)} gal`} note="Last ending" />
                    <AutoField label="+ Delivery (Gallon)" value={`${fmtNum(d.delBag)} gal`} note="Today" />
                    <AutoField label="− Sales (Gallon)" value={`${fmtNum(d.salesBtl)} gal`} note="Today" />
                    <AutoField label="− Borrowed (Gallon)" value={`${fmtNum(d.borrowed)} gal`} note="Unrecorded borrows" />
                    <AutoField label="+ Returned (Gallon)" value={`${fmtNum(d.returned)} gal`} note="Unrecorded returns" />
                  </>
                ) : (
                  <>
                    <AutoField label="Beg. Inv. (Bags)" value={`${fmtNum(d.begBag)} bags`} note="Last ending" />
                    <AutoField label="Beg. Inv. (Bottles)" value={`${fmtNum(d.begBtl)} btl`} note="Last ending" />
                    <AutoField label="+ Delivery (Bottles)" value={`${fmtNum(d.delBag)} btl`} note="Today" />
                    <AutoField label="− Sales (Bottles)" value={`${fmtNum(d.salesBtl)} btl`} note="Today" />
                  </>
                )}
              </div>
              <div className="inv-daily-col">
                <div className="inv-col-head inv-col-head-computed"><span className="material-icons-outlined">calculate</span> Computed</div>
                <div className="inv-field-row inv-field-computed">
                  <div className="inv-field-lbl">Available for Sale</div>
                  <div className="inv-field-val">{fmtNum(d.available)}{isSlim ? ' gal' : ' btl'}</div>
                </div>
                <div className="inv-field-row inv-field-computed">
                  <div className="inv-field-lbl">Expected Ending</div>
                  <div className="inv-field-val inv-expected-val">{fmtNum(d.expected)}{isSlim ? ' gal' : ' btl'}</div>
                </div>
              </div>
              <div className="inv-daily-col">
                <div className="inv-col-head inv-col-head-manual"><span className="material-icons-outlined">edit</span> Enter Actual</div>
                {!isSlim && (
                  <ManualField label="Actual Ending (Bags)" unit="bags" value={values[`${prod}_actualBag`] || ''} onChange={(v) => setVal(`${prod}_actualBag`, v)} />
                )}
                <ManualField label={isSlim ? 'Actual Ending (Gallon)' : 'Actual Ending (Bottles)'} unit={isSlim ? 'gal' : 'btl'} value={values[`${prod}_actualBtl`] || ''} onChange={(v) => setVal(`${prod}_actualBtl`, v)} />
                <div className="inv-daily-result">
                  <div className="inv-result-row"><span>Total Actual</span><span className="inv-result-val">{fmtNum(d.totalActual)}</span></div>
                  <div className="inv-result-row inv-variance-result">
                    <span>Variance</span>
                    <span className={`inv-variance-val ${d.variance < 0 ? 'inv-neg' : d.variance > 0 ? 'inv-pos' : 'inv-zero'}`}>
                      {d.variance >= 0 ? '+' : ''}{fmtNum(d.variance)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      })}

      <div className="inv-page-footer">
        <button type="button" className="inv-btn-primary" onClick={handleReview}>
          <span className="material-icons-outlined">preview</span> Review &amp; Submit
        </button>
      </div>
    </div>
  );
}

function AutoField({ label, value, note }) {
  return (
    <div className="inv-field-row inv-field-auto">
      <div className="inv-field-lbl">{label}</div>
      <div className="inv-field-val inv-auto-val">{value}</div>
      {note && <div className="inv-field-note">{note}</div>}
    </div>
  );
}

function ManualField({ label, unit, value, onChange }) {
  const filled = value !== '' && value !== null && value !== undefined;
  return (
    <div className="inv-field-row inv-field-manual">
      <div className="inv-field-lbl">{label} <span style={{ color: 'var(--destructive)' }}>*</span></div>
      <div className="inv-manual-wrap">
        <input
          type="number" min="0" placeholder="0"
          className={`inv-input inv-manual-input ${filled ? 'inv-input-filled' : 'inv-input-empty'}`}
          value={value} onChange={(e) => onChange(e.target.value)}
        />
        <span className="inv-input-unit">{unit}</span>
      </div>
    </div>
  );
}