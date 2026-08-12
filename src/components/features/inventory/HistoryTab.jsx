import { useEffect, useState } from 'react';
import { getInventoryHistory, GALLON_TYPE_PRODUCTS, fmtNum } from '../../../api/inventory.js';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function fmtDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

function ConfRow({ label, val, bold }) {
  return <div className={`inv-conf-row${bold ? ' inv-conf-bold' : ''}`}><span className="inv-conf-label">{label}</span><span className="inv-conf-val">{val}</span></div>;
}

export default function HistoryTab() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [data, setData] = useState({ records: [] });
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    setLoading(true);
    getInventoryHistory(year, month + 1).then(setData).finally(() => setLoading(false));
  }, [year, month]);

  const recordMap = {};
  data.records.forEach((r) => { recordMap[r.date] = r; });

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  let completeDays = 0, missingDays = 0, negVarDays = 0;
  const countEnd = lastDay < today ? lastDay : today;
  for (let d = new Date(firstDay); d <= countEnd; d.setDate(d.getDate() + 1)) {
    const ds = fmtDate(d);
    if (recordMap[ds]) { completeDays++; if (recordMap[ds].totalVariance < 0) negVarDays++; }
    else missingDays++;
  }

  function prevMonth() { setMonth((m) => { if (m === 0) { setYear((y) => y - 1); return 11; } return m - 1; }); }
  function nextMonth() {
    if (year === today.getFullYear() && month === today.getMonth()) return;
    setMonth((m) => { if (m === 11) { setYear((y) => y + 1); return 0; } return m + 1; });
  }

  const cells = [];
  const startDow = firstDay.getDay();
  for (let b = 0; b < startDow; b++) cells.push(<div className="invh-cell invh-cell-blank" key={`b${b}`} />);

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const cellDate = new Date(year, month, day);
    const dateStr = fmtDate(cellDate);
    const isFuture = cellDate > today;
    const isToday = cellDate.getTime() === today.getTime();
    const rec = recordMap[dateStr];

    let cls = 'invh-cell';
    if (isFuture) cls += ' invh-cell-future';
    else if (rec) cls += ' invh-cell-complete invh-clickable';
    else cls += ' invh-cell-missing';
    if (isToday) cls += ' invh-cell-today';

    cells.push(
      <div key={dateStr} className={cls} onClick={() => rec && setDetail(rec)}>
        {rec?.time && <span className="invh-time-badge">{rec.time}</span>}
        <div className="invh-cell-inner">
          <span className={`invh-day-num${isToday ? ' invh-today-num' : ''}`}>{day}</span>
          {!isFuture && (rec ? (
            <>
              <span className="invh-status-dot invh-dot-complete" title="Complete"><span className="material-icons-outlined">check_circle</span></span>
              {rec.hasDelivery && <span className="invh-delivery-dot" title="Delivery made"><span className="material-icons-outlined">local_shipping</span></span>}
              {rec.products.map((p) => {
                const v = p.variance || 0;
                const vCls = v < 0 ? 'invh-var-neg' : v > 0 ? 'invh-var-pos' : 'invh-var-zero';
                return (
                  <span className={`invh-var-badge invh-var-badge-row ${vCls}`} key={p.name}>
                    <span className="invh-vbr-label">{p.name}</span>
                    <span className="invh-vbr-val">{v >= 0 ? '+' : ''}{v}</span>
                  </span>
                );
              })}
            </>
          ) : (
            <span className="invh-status-dot invh-dot-missing" title="No record"><span className="material-icons-outlined">radio_button_unchecked</span></span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="inv-page-header inv-page-header-row">
        <div>
          <div className="inv-page-title"><span className="material-icons-outlined">calendar_month</span> Inventory History</div>
          <div className="inv-page-sub">Track daily counts and variance trends</div>
        </div>
      </div>

      <div className="invh-month-nav">
        <button type="button" className="invh-nav-btn" onClick={prevMonth}><span className="material-icons-outlined">chevron_left</span></button>
        <div className="invh-month-label">{MONTH_NAMES[month]} {year}</div>
        <button type="button" className="invh-nav-btn" disabled={year === today.getFullYear() && month === today.getMonth()} onClick={nextMonth}>
          <span className="material-icons-outlined">chevron_right</span>
        </button>
      </div>

      <div className="invh-legend-strip">
        <div className="invh-legend-chip inv-legend-complete"><span className="material-icons-outlined">check_circle</span><span>{completeDays} Complete</span></div>
        <div className="invh-legend-chip inv-legend-missing"><span className="material-icons-outlined">event_busy</span><span>{missingDays} Missing</span></div>
        <div className="invh-legend-chip inv-legend-negvar"><span className="material-icons-outlined">trending_down</span><span>{negVarDays} Negative Variance</span></div>
      </div>

      {loading ? <div style={{ padding: '60px 0', textAlign: 'center' }}><div className="spinner" /></div> : (
        <div className="invh-calendar">
          {DAY_LABELS.map((d) => <div className="invh-day-hdr" key={d}>{d}</div>)}
          {cells}
        </div>
      )}

      <div className={`pay-modal-overlay${detail ? ' show' : ''}`}>
        <div className="pay-modal inv-scroll-modal" style={{ maxWidth: 480 }}>
          <div className="pay-modal-header">
            <div className="pay-modal-title"><span className="material-icons-outlined" style={{ verticalAlign: 'middle', marginRight: 6, fontSize: 18 }}>calendar_today</span>{detail?.date} — Inventory Record</div>
            <button type="button" className="pdp-close-btn" onClick={() => setDetail(null)}><span className="material-icons-outlined">close</span></button>
          </div>
          {detail && (
            <div className="pay-modal-body inv-scroll-modal-body">
              {detail.products.map((p) => {
                const isGallonType = !!GALLON_TYPE_PRODUCTS[p.name];
                const isCooledProduct = p.name === '1000 mL';
                const unit = isGallonType ? ' gal' : ' btl';
                const vCls = p.variance < 0 ? 'inv-neg' : p.variance > 0 ? 'inv-pos' : 'inv-zero';
                const fb = p.floorBreakdown || {};
                return (
                  <div className="invh-detail-product" key={p.name}>
                    <div className="invh-detail-prod-hdr">
                      <span className="material-icons-outlined" style={{ color: 'var(--primary)', fontSize: 16 }}>water_drop</span>
                      <span className="invh-detail-prod-name">{p.name}</span>
                    </div>
                    <div className="inv-confirm-grid">
                      {isGallonType ? (
                        <>
                          <ConfRow label="Beg. Inv. (Gallon)" val={`${fmtNum(p.begBag)} gal`} />
                          <ConfRow label="+ Delivery (Gallon)" val={`${fmtNum(p.delBag)} gal`} />
                          <ConfRow label="Available for Sale" val={`${fmtNum(p.available)} gal`} bold />
                          <ConfRow label="− Sales" val={`${fmtNum(p.salesBtl)} gal`} />
                          {p.borrowedGal > 0 && <ConfRow label="− Borrowed (Gallon)" val={`${fmtNum(p.borrowedGal)} gal`} />}
                          {p.returnedGal > 0 && <ConfRow label="+ Returned (Gallon)" val={`${fmtNum(p.returnedGal)} gal`} />}
                          <ConfRow label="Expected Ending" val={`${fmtNum(p.expected)} gal`} bold />
                          <ConfRow label="Actual Ending (Gallon) — 1F/2F" val={`${fmtNum(fb.actualBtl?.first || 0)}/${fmtNum(fb.actualBtl?.second || 0)} = ${fmtNum(p.actualBtl)} gal`} />
                          <ConfRow label="Total Actual" val={`${fmtNum(p.totalActual)} gal`} bold />
                        </>
                      ) : (
                        <>
                          <ConfRow label="Beg. Inv. (Bags)" val={`${fmtNum(p.begBag)} bags`} />
                          <ConfRow label="Beg. Inv. (Tray Bottles)" val={`${fmtNum(p.begBtl)} btl`} />
                          <ConfRow label="+ Delivery (Bottles)" val={`${fmtNum(p.delBag)} btl`} />
                          <ConfRow label="Available for Sale" val={`${fmtNum(p.available)} btl`} bold />
                          <ConfRow label="− Sales" val={`${fmtNum(p.salesBtl)} btl`} />
                          <ConfRow label="Expected Ending" val={`${fmtNum(p.expected)} btl`} bold />
                          <ConfRow label="Actual Ending (Bags) — 1F/2F" val={`${fmtNum(fb.actualBag?.first || 0)}/${fmtNum(fb.actualBag?.second || 0)} = ${fmtNum(p.actualBag)} bags`} />
                          <ConfRow label="Actual Ending (Tray Btl) — 1F/2F" val={`${fmtNum(fb.actualBtl?.first || 0)}/${fmtNum(fb.actualBtl?.second || 0)} = ${fmtNum(p.actualBtl)} btl`} />
                          {isCooledProduct && (
                            <>
                              <ConfRow label="Cooler Box — 1F/2F" val={`${fmtNum(fb.coolerBox?.first || 0)}/${fmtNum(fb.coolerBox?.second || 0)} = ${fmtNum(p.coolerBox)} box`} />
                              <ConfRow label="Cooler Pcs — 1F/2F" val={`${fmtNum(fb.coolerPcs?.first || 0)}/${fmtNum(fb.coolerPcs?.second || 0)} = ${fmtNum(p.coolerPcs)} btl`} />
                              <ConfRow label="Ice Maker — 1F/2F" val={`${fmtNum(fb.iceMakerPcs?.first || 0)}/${fmtNum(fb.iceMakerPcs?.second || 0)} = ${fmtNum(p.iceMakerPcs)} btl`} />
                            </>
                          )}
                          <ConfRow label="Total Actual" val={`${fmtNum(p.totalActual)} btl`} bold />
                        </>
                      )}
                    </div>
                    <div className={`inv-variance-summary ${p.variance < 0 ? 'inv-vsum-neg' : p.variance === 0 ? 'inv-vsum-zero' : 'inv-vsum-pos'}`}>
                      <span className="inv-vsum-label">Variance</span>
                      <span className={`inv-vsum-val ${vCls}`}>{p.variance >= 0 ? '+' : ''}{fmtNum(p.variance)}{unit}</span>
                    </div>
                  </div>
                );
              })}
              <div className="invh-total-variance">
                <span className="invh-tv-label">Total Variance (All Products)</span>
                <span className={`invh-tv-val ${detail.totalVariance < 0 ? 'inv-neg' : detail.totalVariance > 0 ? 'inv-pos' : 'inv-zero'}`}>
                  {detail.totalVariance >= 0 ? '+' : ''}{fmtNum(detail.totalVariance)} btl
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}