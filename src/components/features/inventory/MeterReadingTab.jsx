import { useEffect, useState } from 'react';
import { getMeterReadingData, saveMeterReading, OTHER_PRODUCTS, fmtNum } from '../../../api/inventory.js';
import { showToast as notify } from '../../../utils/toast.js';

function AutoRow({ label, value, note }) {
  return <div className="mr-field-row"><div className="mr-field-lbl">{label}</div><div className="mr-auto-val">{value}</div>{note && <div className="mr-field-note">{note}</div>}</div>;
}
function ManualRow({ label, unit, value, onChange }) {
  return (
    <div className="mr-field-row">
      <div className="mr-field-lbl">{label}</div>
      <div className="mr-manual-wrap">
        <input type="number" className="inv-input mr-input" min="0" step="any" placeholder="0" value={value} onChange={(e) => onChange(e.target.value)} />
        <span className="inv-input-unit">{unit}</span>
      </div>
    </div>
  );
}
function ComputedRow({ label, value, cls, formula }) {
  return <div className="mr-field-row"><div className="mr-field-lbl">{label}</div><div className={`mr-computed-val ${cls || ''}`}>{value}</div>{formula && <div className="mr-field-note">{formula}</div>}</div>;
}
function Section({ icon, title, children }) {
  return (
    <div className="mr-section">
      <div className="mr-section-head"><span className="material-icons-outlined">{icon}</span><span>{title}</span></div>
      <div className="mr-section-body">{children}</div>
    </div>
  );
}
function ConfirmCard({ title, rows }) {
  return (
    <div className="inv-confirm-card">
      <div className="inv-confirm-card-title">{title}</div>
      <div className="inv-confirm-grid">
        {rows.map((r, i) => (
          <div key={i} className={`inv-conf-row${r[2] ? ' inv-conf-bold' : ''}`}><span className="inv-conf-label">{r[0]}</span><span className="inv-conf-val">{r[1]}</span></div>
        ))}
      </div>
    </div>
  );
}

export default function MeterReadingTab({ onGoToDaily }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [convPoly, setConvPoly] = useState(19.2);
  const [convSlim, setConvSlim] = useState(20.2);
  const [vals, setVals] = useState({});
  const [reviewing, setReviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getMeterReadingData().then((d) => {
      setData(d);
      if (d.convPoly) setConvPoly(d.convPoly);
      if (d.convSlim) setConvSlim(d.convSlim);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function v(key) { return parseFloat(vals[key]) || 0; }
  function set(key, val) { setVals((p) => ({ ...p, [key]: val })); }

  if (loading) return <div style={{ padding: '80px 0', textAlign: 'center' }}><div className="spinner" /></div>;
  if (!data) return <div className="empty-state" style={{ padding: 48 }}>Error loading meter data.</div>;

  if (!data.dailyCountDone) {
    return (
      <div className="mr-blocked">
        <span className="material-icons-outlined mr-blocked-icon">fact_check</span>
        <div className="mr-blocked-title">Daily Count Required</div>
        <div className="mr-blocked-sub">Please complete today's Daily Inventory Count before entering Meter Reading.</div>
        <button type="button" className="inv-btn-primary" onClick={onGoToDaily}><span className="material-icons-outlined">fact_check</span> Go to Daily Count</button>
      </div>
    );
  }

  // ---- calc ----
  const stockBeg = data.stockBeg || {};
  const stockSold = data.stockSold || {};
  const begPoly = Number(stockBeg.poly) || 0;
  const begSlim = Number(stockBeg.slim) || 0;
  const endPoly = v('stockEndPoly');
  const endSlim = v('stockEndSlim');
  const soldPoly = Number(stockSold.poly) || 0;
  const soldSlim = Number(stockSold.slim) || 0;
  const totalStockPoly = endPoly + soldPoly - begPoly;
  const totalStockSlim = endSlim + soldSlim - begSlim;
  const soldStockL = totalStockPoly + totalStockSlim;

  const dc = data.dailyCount || {};
  const dc500 = dc['500 mL'] || {};
  const dc1000 = dc['1000 mL'] || {};
  const ref500 = (dc500.begTotal || 0) + (dc500.delivery || 0) - (dc500.ending || 0);
  const lit500 = ref500 * 0.5;
  const ref1000 = (dc1000.begTotal || 0) + (dc1000.delivery || 0) - (dc1000.ending || 0);
  const lit1000 = ref1000 * 1.0;
  const bottleTotal = lit500 + lit1000;

  const galSales = data.galSales || {};
  const galSoldPoly = Number(galSales.poly) || 0;
  const galSoldSlim = Number(galSales.slim) || 0;
  const galUnrefPoly = v('galUnrefilledPoly');
  const galUnrefSlim = v('galUnrefilledSlim');
  const galRefPoly = galSoldPoly - galUnrefPoly;
  const galRefSlim = galSoldSlim - galUnrefSlim;
  const galLitPoly = galRefPoly * convPoly;
  const galLitSlim = galRefSlim * convSlim;
  const galTotal = galLitPoly + galLitSlim;

  const oc = data.otherCounts || {};
  const o6 = Number(oc['6L']) || 0, o7 = Number(oc['7L']) || 0, o8 = Number(oc['8L']) || 0, o10 = Number(oc['10L']) || 0;
  const l6 = o6 * 6, l7 = o7 * 7, l8 = o8 * 8, l10 = o10 * 10;
  const otherTotal = l6 + l7 + l8 + l10;

  const actualRefilled = bottleTotal + galTotal + otherTotal;
  const meterBeg = Number(data.meterBeg) || 0;
  const meterEnd = v('meterEnd');
  const meterExpected = meterEnd - meterBeg;
  const variance = actualRefilled - meterExpected;

  const missingFields = ['stockEndPoly', 'stockEndSlim', 'meterEnd'].filter((k) => vals[k] === undefined || vals[k] === '');

  function handleReview() {
    if (missingFields.length) { notify('Please fill in all required fields (*).'); return; }
    setReviewing(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    const payload = {
      date: data.date, convPoly, convSlim,
      stockBegPoly: begPoly, stockEndPoly: endPoly, soldPoly,
      stockBegSlim: begSlim, stockEndSlim: endSlim, soldSlim,
      ref500Btl: ref500, ref500L: lit500, ref1000Btl: ref1000, ref1000L: lit1000, bottleTotalL: bottleTotal,
      galSoldPoly, galUnrefPoly, galRefPoly, galLitPoly,
      galSoldSlim, galUnrefSlim, galRefSlim, galLitSlim, galTotalL: galTotal,
      other6L: o6, other7L: o7, other8L: o8, other10L: o10, otherTotalL: otherTotal,
      actualRefilledL: actualRefilled, meterBeg, meterEnd, meterExpected, variance,
    };
    try {
      const res = await saveMeterReading(payload);
      if (res.success) {
        notify('Meter Reading saved!');
        setVals({}); setReviewing(false); setLoading(true);
        const fresh = await getMeterReadingData();
        setData(fresh); setLoading(false);
      } else notify('Error: ' + res.message);
    } catch (err) { notify('Error: ' + (err?.message || 'Unknown')); }
    setSubmitting(false);
  }

  const varCls = variance < 0 ? 'mr-var-neg' : variance > 0 ? 'mr-var-pos' : 'mr-var-zero';

  if (reviewing) {
    return (
      <div>
        <div className="inv-page-header">
          <div className="inv-page-title"><span className="material-icons-outlined">preview</span> Review Meter Reading</div>
          <div className="inv-page-sub">{data.date}</div>
        </div>
        <ConfirmCard title="Stock" rows={[
          ['Beg. Stock (Poly)', `${begPoly} pcs`], ['Ending Stock (Poly)', `${endPoly} pcs`], ['Sold (Poly)', `${soldPoly} pcs`, true],
          ['Beg. Stock (Slim)', `${begSlim} pcs`], ['Ending Stock (Slim)', `${endSlim} pcs`], ['Sold (Slim)', `${soldSlim} pcs`, true],
        ]} />
        <ConfirmCard title="Refill (Bottles)" rows={[
          ['500 mL Refilled', `${ref500} btl → ${lit500} L`], ['1000 mL Refilled', `${ref1000} btl → ${lit1000} L`],
          ['Total Bottle Liters', `${fmtNum(bottleTotal)} L`, true],
        ]} />
        <ConfirmCard title="5-Gallon" rows={[
          ['Poly: Sold / Unref / Ref', `${galSoldPoly} / ${galUnrefPoly} / ${galRefPoly} gal`],
          ['Poly Liters', `${fmtNum(galLitPoly)} L (× ${convPoly})`],
          ['Slim: Sold / Unref / Ref', `${galSoldSlim} / ${galUnrefSlim} / ${galRefSlim} gal`],
          ['Slim Liters', `${fmtNum(galLitSlim)} L (× ${convSlim})`],
          ['Total Gallon Liters', `${fmtNum(galTotal)} L`, true],
        ]} />
        <ConfirmCard title="Other Products" rows={[
          [`6L × ${o6}`, `${fmtNum(l6)} L`], [`7L × ${o7}`, `${fmtNum(l7)} L`], [`8L × ${o8}`, `${fmtNum(l8)} L`], [`10L × ${o10}`, `${fmtNum(l10)} L`],
          ['Total Others', `${fmtNum(otherTotal)} L`, true],
        ]} />
        <ConfirmCard title="Meter" rows={[
          ['Beginning Reading', `${fmtNum(meterBeg)} L`], ['Actual Reading (End)', `${fmtNum(meterEnd)} L`], ['Expected Refilled', `${fmtNum(meterExpected)} L`, true],
        ]} />
        <div className="mr-summary-card">
          <div className="mr-summary-row"><span>Actual Refilled Liters</span><span className="mr-summary-val">{fmtNum(actualRefilled)} L</span></div>
          <div className="mr-summary-row"><span>Expected (Meter)</span><span className="mr-summary-val">{fmtNum(meterExpected)} L</span></div>
          <div className="mr-summary-divider" />
          <div className="mr-summary-row mr-summary-var"><span>Variance</span><span className={`mr-summary-varval ${varCls}`}>{variance >= 0 ? '+' : ''}{fmtNum(variance)} L</span></div>
        </div>
        <div className="inv-page-footer">
          <button type="button" className="inv-btn-ghost" onClick={() => setReviewing(false)}><span className="material-icons-outlined">arrow_back</span> Back</button>
          <button type="button" className="inv-btn-primary" disabled={submitting} onClick={handleSubmit}>
            <span className="material-icons-outlined">check_circle</span> {submitting ? 'Saving...' : 'Submit Meter Reading'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="inv-page-header inv-page-header-row">
        <div>
          <div className="inv-page-title"><span className="material-icons-outlined">speed</span> Meter Reading</div>
          <div className="inv-page-sub">{data.date} &nbsp;·&nbsp; All values in liters</div>
        </div>
        <div className="mr-conv-settings">
          <span className="mr-conv-label">Conversion (L):</span>
          <label className="mr-conv-item">Poly <input type="number" className="mr-conv-input" step="0.1" min="1" value={convPoly} onChange={(e) => setConvPoly(parseFloat(e.target.value) || 19.2)} /></label>
          <label className="mr-conv-item">Slim <input type="number" className="mr-conv-input" step="0.1" min="1" value={convSlim} onChange={(e) => setConvSlim(parseFloat(e.target.value) || 20.2)} /></label>
        </div>
      </div>

      <Section icon="inventory_2" title="Stock">
        <div className="mr-cols-2">
          <div className="mr-col">
            <div className="mr-col-head">Poly</div>
            <AutoRow label="Beginning Stock" value={stockBeg.poly != null ? stockBeg.poly : '--'} note="Yesterday's ending" />
            <ManualRow label="Ending Stock *" unit="pcs" value={vals.stockEndPoly || ''} onChange={(val) => set('stockEndPoly', val)} />
            <AutoRow label="Sold Stock" value={`${fmtNum(soldPoly)} pcs`} note="From current shift" />
            <ComputedRow label="Total Stock (pcs)" value={fmtNum(totalStockPoly)} formula="End + Sold − Beg" />
          </div>
          <div className="mr-col">
            <div className="mr-col-head">Slim</div>
            <AutoRow label="Beginning Stock" value={stockBeg.slim != null ? stockBeg.slim : '--'} note="Yesterday's ending" />
            <ManualRow label="Ending Stock *" unit="pcs" value={vals.stockEndSlim || ''} onChange={(val) => set('stockEndSlim', val)} />
            <AutoRow label="Sold Stock" value={`${fmtNum(soldSlim)} pcs`} note="From current shift" />
            <ComputedRow label="Total Stock (pcs)" value={fmtNum(totalStockSlim)} formula="End + Sold − Beg" />
          </div>
        </div>
        <div className="mr-total-bar"><span>Total Stock (pcs)</span><span className="mr-total-val">{fmtNum(totalStockPoly + totalStockSlim)} pcs</span></div>
      </Section>

      <Section icon="water_drop" title="Refill (Bottles)">
        <div className="mr-cols-2">
          <div className="mr-col">
            <div className="mr-col-head">500 mL</div>
            <AutoRow label="Beg. Bottles" value={`${fmtNum(dc500.begTotal || 0)} btl`} note="From Daily Count" />
            <AutoRow label="+ Delivery" value={`${fmtNum(dc500.delivery || 0)} btl`} note="From Daily Count" />
            <AutoRow label="− Ending" value={`${fmtNum(dc500.ending || 0)} btl`} note="From Daily Count" />
            <ComputedRow label="Refilled (btl)" value={fmtNum(ref500)} formula="Beg + Del − End" />
            <ComputedRow label="Refilled (L)" value={fmtNum(lit500)} formula="× 0.5 L" />
          </div>
          <div className="mr-col">
            <div className="mr-col-head">1000 mL</div>
            <AutoRow label="Beg. Bottles" value={`${fmtNum(dc1000.begTotal || 0)} btl`} note="From Daily Count" />
            <AutoRow label="+ Delivery" value={`${fmtNum(dc1000.delivery || 0)} btl`} note="From Daily Count" />
            <AutoRow label="− Ending" value={`${fmtNum(dc1000.ending || 0)} btl`} note="From Daily Count" />
            <ComputedRow label="Refilled (btl)" value={fmtNum(ref1000)} formula="Beg + Del − End" />
            <ComputedRow label="Refilled (L)" value={fmtNum(lit1000)} formula="× 1.0 L" />
          </div>
        </div>
        <div className="mr-total-bar"><span>Total Refilled Bottles</span><span className="mr-total-val">{fmtNum(bottleTotal)} L</span></div>
      </Section>

      <Section icon="local_drink" title="5-Gallon">
        <div className="mr-cols-2">
          <div className="mr-col">
            <div className="mr-col-head">Poly (× {convPoly} L)</div>
            <AutoRow label="Sold (POS)" value={`${fmtNum(galSoldPoly)} gal`} note="From POS sales" />
            <ManualRow label="Unrefilled *" unit="gal" value={vals.galUnrefilledPoly || ''} onChange={(val) => set('galUnrefilledPoly', val)} />
            <ComputedRow label="Refilled (gal)" value={fmtNum(galRefPoly)} formula="Sold − Unrefilled" />
            <ComputedRow label="Refilled (L)" value={fmtNum(galLitPoly)} formula={`× ${convPoly} L`} />
          </div>
          <div className="mr-col">
            <div className="mr-col-head">Slim (× {convSlim} L)</div>
            <AutoRow label="Sold (POS)" value={`${fmtNum(galSoldSlim)} gal`} note="From POS sales" />
            <ManualRow label="Unrefilled *" unit="gal" value={vals.galUnrefilledSlim || ''} onChange={(val) => set('galUnrefilledSlim', val)} />
            <ComputedRow label="Refilled (gal)" value={fmtNum(galRefSlim)} formula="Sold − Unrefilled" />
            <ComputedRow label="Refilled (L)" value={fmtNum(galLitSlim)} formula={`× ${convSlim} L`} />
          </div>
        </div>
        <div className="mr-total-bar"><span>Total Refilled Gallon</span><span className="mr-total-val">{fmtNum(galTotal)} L</span></div>
      </Section>

      <Section icon="category" title="Other Products">
        <div className="mr-cols-4">
          <div className="mr-col"><AutoRow label="6L Bottles" value={`${fmtNum(o6)} pcs`} note="From current shift" /><ComputedRow label="Liters" value={fmtNum(l6)} formula="× 6 L" /></div>
          <div className="mr-col"><AutoRow label="7L Bottles" value={`${fmtNum(o7)} pcs`} note="From current shift" /><ComputedRow label="Liters" value={fmtNum(l7)} formula="× 7 L" /></div>
          <div className="mr-col"><AutoRow label="8L Bottles" value={`${fmtNum(o8)} pcs`} note="From current shift" /><ComputedRow label="Liters" value={fmtNum(l8)} formula="× 8 L" /></div>
          <div className="mr-col"><AutoRow label="10L Bottles" value={`${fmtNum(o10)} pcs`} note="From current shift" /><ComputedRow label="Liters" value={fmtNum(l10)} formula="× 10 L" /></div>
        </div>
        <div className="mr-total-bar"><span>Total Other Products</span><span className="mr-total-val">{fmtNum(otherTotal)} L</span></div>
      </Section>

      <Section icon="analytics" title="Actual Refilled & Meter (Liters)">
        <div className="mr-actual-breakdown">
          <div className="mr-ab-row"><span>Sold Stock (pcs)</span><span className="mr-ab-val">{fmtNum(soldStockL)}</span></div>
          <div className="mr-ab-row"><span>+ Refilled Bottles (L)</span><span className="mr-ab-val inv-num-green">{fmtNum(bottleTotal)}</span></div>
          <div className="mr-ab-row"><span>+ Refilled Gallon (L)</span><span className="mr-ab-val inv-num-green">{fmtNum(galTotal)}</span></div>
          <div className="mr-ab-row"><span>+ Other Products (L)</span><span className="mr-ab-val inv-num-green">{fmtNum(otherTotal)}</span></div>
          <div className="mr-ab-divider" />
          <div className="mr-ab-row mr-ab-total"><span>Actual Refilled Liters</span><span className={`mr-ab-val ${actualRefilled < 0 ? 'inv-neg' : 'inv-pos'}`}>{fmtNum(actualRefilled)} L</span></div>
        </div>
        <div className="mr-meter-grid">
          <div className="mr-meter-col">
            <AutoRow label="Beginning Reading" value={data.meterBeg != null ? `${fmtNum(data.meterBeg)} L` : '--'} note="Yesterday's ending" />
            <ManualRow label="Actual Reading (End) *" unit="L" value={vals.meterEnd || ''} onChange={(val) => set('meterEnd', val)} />
            <ComputedRow label="Expected Refilled" value={fmtNum(meterExpected)} cls="mr-expected-val" formula="End − Beginning" />
          </div>
          <div className="mr-meter-col mr-variance-col">
            <div className="mr-variance-display">
              <div className="mr-var-label">Variance (L)</div>
              <div className={`mr-var-value ${meterEnd === 0 ? '' : varCls}`}>{meterEnd === 0 ? '--' : `${variance >= 0 ? '+' : ''}${fmtNum(variance)}`}</div>
              <div className="mr-var-formula">Actual Refilled − Expected Refilled Liters</div>
            </div>
          </div>
        </div>
      </Section>

      <div className="inv-page-footer">
        <button type="button" className="inv-btn-primary" onClick={handleReview}>
          <span className="material-icons-outlined">preview</span> Review &amp; Submit
        </button>
      </div>
    </div>
  );
}