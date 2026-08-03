import { useEffect, useRef, useState } from 'react';
import { getVarianceReport, INV_PRODUCTS, fmtNum } from '../../../api/inventory.js';
import { showToast as notify } from '../../../utils/toast.js';

const TABS = [
  { key: 'today', label: 'Today' }, { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' }, { key: 'all', label: 'All Time' }, { key: 'custom', label: 'Custom' },
];

export default function VarianceTab() {
  const [active, setActive] = useState('today');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [data, setData] = useState({ rows: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  async function load(tf, from, to) {
    setLoading(true);
    try {
      const d = await getVarianceReport(tf, from, to);
      setData(d);
    } catch { notify('Failed to load variance report.'); }
    setLoading(false);
  }

  useEffect(() => { load('today'); }, []);

  function handleTab(tf) {
    setActive(tf);
    if (tf !== 'custom') load(tf);
  }

  function applyCustom() {
    if (!customFrom || !customTo) { notify('Please select both From and To dates.'); return; }
    if (customFrom > customTo) { notify('From date must be before To date.'); return; }
    load('custom', customFrom, customTo);
  }

  useEffect(() => {
    if (!data.rows?.length || !canvasRef.current) return;
    let destroyed = false;
    import('chart.js/auto').then(({ default: Chart }) => {
      if (destroyed) return;
      if (chartRef.current) chartRef.current.destroy();
      const datasets = {};
      data.rows.forEach((r) => { if (!datasets[r.product]) datasets[r.product] = []; datasets[r.product].push({ x: r.date, y: r.variance }); });
      const colors = ['hsl(183,42%,46%)', 'hsl(38,80%,50%)', 'hsl(270,40%,55%)'];
      chartRef.current = new Chart(canvasRef.current, {
        type: 'line',
        data: { datasets: Object.keys(datasets).map((p, i) => ({ label: p, data: datasets[p], borderColor: colors[i] || 'gray', tension: 0.4, fill: false, pointRadius: 3 })) },
        options: { responsive: true, maintainAspectRatio: true, parsing: false, scales: { x: { type: 'category' } }, plugins: { legend: { position: 'top' } } },
      });
    });
    return () => { destroyed = true; if (chartRef.current) chartRef.current.destroy(); };
  }, [data]);

  return (
    <div>
      <div className="inv-page-header inv-page-header-row">
        <div className="inv-page-title"><span className="material-icons-outlined">analytics</span> Variance Report</div>
        <div className="inv-var-tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={`inv-var-tab${active === t.key ? ' active' : ''}`} onClick={() => handleTab(t.key)}>{t.label}</button>
          ))}
        </div>
      </div>

      {active === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <label style={{ fontSize: 13, color: 'var(--muted-fg)', fontWeight: 600 }}>From</label>
          <input type="date" className="pdp-input" style={{ width: 160 }} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          <label style={{ fontSize: 13, color: 'var(--muted-fg)', fontWeight: 600 }}>To</label>
          <input type="date" className="pdp-input" style={{ width: 160 }} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          <button type="button" className="inv-btn-primary" onClick={applyCustom}><span className="material-icons-outlined">search</span> Apply</button>
        </div>
      )}

      {loading ? <div style={{ padding: '80px 0', textAlign: 'center' }}><div className="spinner" /></div> : (
        <>
          <div className="inv-var-summary-row">
            {INV_PRODUCTS.map((p) => {
              const tot = (data.summary[p] || {}).total || 0;
              const cls = tot < 0 ? 'inv-neg' : tot > 0 ? 'inv-pos' : 'inv-zero';
              return (
                <div className="inv-var-scard" key={p}>
                  <div className="inv-var-sprod">{p}</div>
                  <div className={`inv-var-stotal ${cls}`}>{tot >= 0 ? '+' : ''}{fmtNum(tot)}</div>
                  <div className="inv-var-sunit">bottles</div>
                </div>
              );
            })}
          </div>

          <div className="card"><div className="card-body" style={{ overflowX: 'auto', padding: 20 }}>
            <table className="data-table">
              <thead><tr><th>Date</th><th>Product</th><th style={{ textAlign: 'center' }}>Expected</th><th style={{ textAlign: 'center' }}>Actual</th><th style={{ textAlign: 'center' }}>Variance</th></tr></thead>
              <tbody>
                {data.rows.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: 48, color: 'var(--muted-fg)' }}>No data for this period.</td></tr>
                ) : data.rows.map((r, i) => {
                  const cls = r.variance < 0 ? 'inv-neg text-bold' : r.variance > 0 ? 'inv-pos text-bold' : 'inv-zero';
                  return (
                    <tr key={i}>
                      <td>{r.date}</td><td>{r.product}</td>
                      <td style={{ textAlign: 'center' }}>{fmtNum(r.expected)}</td>
                      <td style={{ textAlign: 'center' }}>{fmtNum(r.actual)}</td>
                      <td style={{ textAlign: 'center' }} className={cls}>{r.variance >= 0 ? '+' : ''}{fmtNum(r.variance)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div></div>

          {data.rows.length > 0 && (
            <div className="inv-card inv-chart-card">
              <div className="inv-card-title"><span className="material-icons-outlined">show_chart</span> Variance Trend</div>
              <canvas ref={canvasRef} style={{ maxHeight: 220 }} />
            </div>
          )}
        </>
      )}
    </div>
  );
}