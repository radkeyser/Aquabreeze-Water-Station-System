import { useEffect, useRef, useState } from 'react';
import { getInventoryDashboard, fmtNum } from '../../../src/api/inventory.js';

function PcRow({ icon, label, value, cls }) {
  return (
    <div className="inv-pc-row">
      <span className="material-icons-outlined inv-pc-icon">{icon}</span>
      <span className="inv-pc-label">{label}</span>
      <span className={`inv-pc-val ${cls || ''}`}>{value}</span>
    </div>
  );
}

export default function DashboardTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    getInventoryDashboard().then((d) => { if (mounted) { setData(d); setLoading(false); } })
      .catch(() => setLoading(false));
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!data?.trend?.length || !canvasRef.current) return;
    let destroyed = false;
    import('chart.js/auto').then(({ default: Chart }) => {
      if (destroyed) return;
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new Chart(canvasRef.current, {
        type: 'line',
        data: {
          labels: data.trend.map((t) => t.date),
          datasets: [
            { label: 'Purchases (btl)', data: data.trend.map((t) => t.purchases), borderColor: 'hsl(183,42%,46%)', backgroundColor: 'hsla(183,42%,46%,0.08)', tension: 0.4, fill: true, pointRadius: 3 },
            { label: 'Variance (btl)', data: data.trend.map((t) => t.variance), borderColor: 'hsl(0,65%,55%)', backgroundColor: 'hsla(0,65%,55%,0.06)', tension: 0.4, fill: true, pointRadius: 3, borderDash: [5, 3] },
          ],
        },
        options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'top' } } },
      });
    });
    return () => { destroyed = true; if (chartRef.current) chartRef.current.destroy(); };
  }, [data]);

  if (loading) return <div style={{ padding: '80px 0', textAlign: 'center' }}><div className="spinner" /></div>;
  if (!data) return <div className="empty-state" style={{ padding: 48 }}>Error loading dashboard.</div>;

  return (
    <div>
      <div className="inv-page-header inv-page-header-row">
        <div>
          <div className="inv-page-title"><span className="material-icons-outlined">dashboard</span> Dashboard</div>
          <div className="inv-page-sub">Live overview of today's inventory</div>
        </div>
      </div>

      <div className="inv-card inv-alerts-card">
        <div className="inv-card-title">
          <span className="material-icons-outlined">notifications_active</span> Alerts
          {data.alerts.length > 0 && <span className="inv-alert-badge">{data.alerts.length}</span>}
        </div>
        {data.alerts.length === 0 ? (
          <div className="inv-no-alerts"><span className="material-icons-outlined">check_circle</span> All good — no alerts</div>
        ) : data.alerts.map((a, i) => (
          <div key={i} className={`inv-alert-row ${a.type === 'low' ? 'inv-alert-low' : a.type === 'missing' ? 'inv-alert-missing' : 'inv-alert-info'}`}>
            <span className="material-icons-outlined">{a.type === 'low' ? 'warning' : a.type === 'missing' ? 'event_busy' : 'info'}</span>
            <span>{a.message}</span>
          </div>
        ))}
      </div>

      <div className="inv-section-label"><span className="material-icons-outlined">inventory_2</span> Today's Inventory Status</div>
      <div className="inv-product-cards">
        {data.products.map((p) => {
          const isSlim = p.name === 'Slim Gallon';
          const unit = isSlim ? ' gal' : ' btl';
          const expCls = p.expectedEnding < 0 ? 'inv-neg' : 'inv-num-teal';
          return (
            <div className="inv-product-card" key={p.name}>
              <div className="inv-pc-header">
                <span className="inv-pc-name">{p.name}</span>
                {p.unit !== 'unit' && <span className="inv-pc-badge">{p.unit}</span>}
              </div>
              <div className="inv-pc-flow">
                <PcRow icon="water_drop" label="Beginning Inv." value={fmtNum(p.beginning) + unit} />
                <PcRow icon="add_circle" label="+ Deliveries" value={`+${fmtNum(p.deliveries)}${unit}`} cls="inv-num-green" />
                <PcRow icon="remove_circle" label="− Sales" value={`−${fmtNum(p.sales)}${unit}`} cls="inv-num-red" />
                {isSlim && p.borrowed > 0 && <PcRow icon="arrow_circle_down" label="− Borrowed" value={`−${fmtNum(p.borrowed)}${unit}`} cls="inv-num-red" />}
                {isSlim && p.returned > 0 && <PcRow icon="arrow_circle_up" label="+ Returned" value={`+${fmtNum(p.returned)}${unit}`} cls="inv-num-green" />}
                <div className="inv-pc-divider" />
                <PcRow icon="calculate" label="Expected Ending" value={fmtNum(p.expectedEnding) + unit} cls={`${expCls} inv-num-lg`} />
              </div>
            </div>
          );
        })}
      </div>

      {data.trend?.length > 0 && (
        <div className="inv-card inv-chart-card">
          <div className="inv-card-title"><span className="material-icons-outlined">show_chart</span> 14-Day Trend</div>
          <canvas ref={canvasRef} style={{ maxHeight: 220 }} />
        </div>
      )}
    </div>
  );
}