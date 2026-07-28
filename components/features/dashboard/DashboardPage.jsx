import { useState, useEffect, useMemo } from 'react';
// material icons will be rendered via <span className="material-icons-outlined">name</span>
import DataTable from '../../../src/scripts/DataTable.jsx';
import MiniTable from '../../../src/scripts/MiniTable.jsx';
import ChartCard from '../../../src/scripts/ChartCard.jsx';
import { computeProcessed } from '../../../src/utils/computeReports';
import { getReportsData } from '../../../src/api/reports';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart as ReBarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from 'recharts';

const STATS = [
  { key: 'sales', label: 'Total Sales', icon: 'bar_chart', color: 'teal' },
  { key: 'orders', label: 'Total Orders', icon: 'shopping_cart', color: 'green' },
  { key: 'expenses', label: 'Total Expenses', icon: 'receipt_long', color: 'red' },
  { key: 'pautang', label: 'Total Pautang', icon: 'person', color: 'orange' },
  { key: 'collections', label: 'Total Collections', icon: 'account_balance_wallet', color: 'blue' },
  { key: 'advances', label: 'Total Advances', icon: 'savings', color: 'amber' },
];

const DATE_FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

const VIEW_TABS = [
  { key: 'tables', label: 'Tables', icon: 'table_chart' },
  { key: 'charts', label: 'Charts', icon: 'bar_chart' },
];

const SALES_COLUMNS = [
  { key: 'product', label: 'Product' },
  { key: 'qty', label: 'Qty', align: 'center' },
  { key: 'unitCost', label: 'Unit Cost', align: 'right' },
  { key: 'amount', label: 'Amount', align: 'right' },
];

export default function DashboardPage() {
  const [dateFilter, setDateFilter] = useState('today');
  const [view, setView] = useState('tables');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [loading, setLoading] = useState(false);
  const [rawData, setRawData] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getReportsData()
      .then((data) => { if (!mounted) return; setRawData(data); })
      .catch((e) => { console.error('reports fetch error', e); })
      .finally(() => { setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const processed = useMemo(() => computeProcessed(rawData, dateFilter, customFrom, customTo), [rawData, dateFilter, customFrom, customTo]);

  function formatPeso(amount) {
    return '₱' + Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <div className="dash-wrapper">
      <div className="dash-stat-row">
        {STATS.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={s.key} id={`dashStat${i}`} className={`dash-stat-card dash-stat-${s.color}`}>
              <div className="dash-stat-icon"><span className="material-icons-outlined">{Icon}</span></div>
              <div className="dash-stat-info">
                <div className="dash-stat-val">{processed ? formatPeso(processed.totalSales || 0) : '—'}</div>
                <div className="dash-stat-label">{s.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="dash-filter-bar">
        <div className="dash-filter-left">
          <span className="material-icons-outlined" style={{ color: 'hsl(var(--primary))', fontSize: 17 }}>filter_list</span>
          <span className="dash-filter-title">Date Filter</span>
        </div>

        <div className="dash-filter-tabs">
          {DATE_FILTERS.map((f) => (
            <button key={f.key} className={`dash-filter-tab ${dateFilter === f.key ? 'active' : ''}`} onClick={() => setDateFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="dash-custom-dates" style={{ display: dateFilter === 'custom' ? 'flex' : 'none' }}>
          <div className="dash-date-group">
            <label className="dash-date-label">From</label>
            <input className="pdp-input dash-date-input" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
          </div>
          <span className="dash-arrow">→</span>
          <div className="dash-date-group">
            <label className="dash-date-label">To</label>
            <input className="pdp-input dash-date-input" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
          <button className="btn-apply-dates" onClick={() => { /* noop — processed recomputes via useMemo */ }}>Apply</button>
        </div>

        <div className="dash-view-switcher">
          {VIEW_TABS.map((t) => (
            <button key={t.key} className={`dash-view-btn ${view === t.key ? 'active' : ''}`} onClick={() => setView(t.key)}>
              <span className="material-icons-outlined">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
      </div>

      <div id="dashContent" className="dash-content-area">
        {view === 'tables' ? (
          <>
            <div className="dash-row dash-row-top">
              <div className="dash-card">
                <div className="dash-card-header"><span className="material-icons-outlined">table_chart</span> <span>Sales Report</span></div>
                <MiniTable columns={SALES_COLUMNS} rows={processed?.salesRows || []} emptyLabel="No data" footerLabel="TOTAL SALES" footerValue={formatPeso(processed?.totalSales)} />
              </div>

              <div className="dash-card">
                <div className="dash-card-header"><span className="material-icons-outlined">receipt_long</span> <span>Expense Report</span></div>
                <MiniTable columns={[{ key: 'description', label: 'Description' }, { key: 'amount', label: 'Amount', align: 'right' }]} rows={processed?.expenseRows || []} emptyLabel="No data" footerLabel="TOTAL EXPENSE" footerValue={formatPeso(processed?.totalExpense)} />
              </div>
            </div>

            <div className="dash-row dash-row-bottom">
              <div className="dash-card">
                <div className="dash-card-header"><span className="material-icons-outlined">person</span> <span>Pautang</span></div>
                <MiniTable columns={[{ key: 'pointPerson', label: 'Point Person' }, { key: 'count', label: 'Rec.', align: 'center' }, { key: 'total', label: 'Total Utang', align: 'right' }]} rows={processed?.ppRows || []} emptyLabel="No data" footerLabel="TOTAL UTANG" footerValue={formatPeso(processed?.totalUtang)} />
              </div>

              <div className="dash-card">
                <div className="dash-card-header"><span className="material-icons-outlined">account_balance_wallet</span> <span>Collections</span></div>
                <MiniTable columns={[{ key: 'pointPerson', label: 'Point Person' }, { key: 'count', label: 'Rec.', align: 'center' }, { key: 'total', label: 'Total Collected', align: 'right' }]} rows={processed?.colRows || []} emptyLabel="No data" footerLabel="TOTAL COLLECTED" footerValue={formatPeso(processed?.totalCollect)} />
              </div>

              <div className="dash-card">
                <div className="dash-card-header"><span className="material-icons-outlined">savings</span> <span>Advances</span></div>
                <MiniTable columns={[{ key: 'staff', label: 'Staff Name' }, { key: 'amount', label: 'Amount', align: 'right' }]} rows={processed?.advRows || []} emptyLabel="No data" footerLabel="TOTAL ADVANCES" footerValue={formatPeso(processed?.totalAdv)} />
              </div>
            </div>
          </>
        ) : (
          <div className="dash-charts-grid">
            {[
              { key: 'qtyByDate', icon: 'local_drink', title: 'Product Quantity Sold by Date', full: true, node: (
                <ResponsiveContainer width="100%" height={360}>
                  <LineChart data={processed?.salesTrend || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f3" />
                    <XAxis dataKey="date" tick={{ fontSize:12 }} />
                    <YAxis tick={{ fontSize:12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#06b6a4" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )},
              { key: 'statusPie', icon: 'show_chart', title: 'Order Status Breakdown', node: (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={processed?.statusPie || []} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} label paddingAngle={2}>
                      {(processed?.statusPie || []).map((entry, idx) => (
                        <Cell key={idx} fill={['#4caf50', '#ffb300', '#f44336'][idx % 3]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )},
              { key: 'salesByPP', icon: 'people', title: 'Sales by Point Person', node: (
                <ResponsiveContainer width="100%" height={240}>
                  <ReBarChart data={processed?.salesByPP || []} barSize={12} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f3" />
                    <XAxis dataKey="name" tick={{ fontSize:12 }} />
                    <YAxis tick={{ fontSize:12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#4caf50" radius={[6,6,0,0]} />
                  </ReBarChart>
                </ResponsiveContainer>
              )},
              { key: 'advByPP', icon: 'savings', title: 'Point Person Advances', node: (
                <ResponsiveContainer width="100%" height={240}>
                  <ReBarChart data={processed?.advByPP || []} barSize={12} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f3" />
                    <XAxis dataKey="name" tick={{ fontSize:12 }} />
                    <YAxis tick={{ fontSize:12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#ff9800" radius={[6,6,0,0]} />
                  </ReBarChart>
                </ResponsiveContainer>
              )},
              { key: 'salesVsExp', icon: 'swap_horiz', title: 'Sales vs Expenses', node: (
                <ResponsiveContainer width="100%" height={240}>
                  <ReBarChart data={processed?.salesVsExpenses || []} barSize={12} barCategoryGap="20%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f3" />
                    <XAxis dataKey="date" tick={{ fontSize:12 }} />
                    <YAxis tick={{ fontSize:12 }} />
                    <Tooltip />
                    <Bar dataKey="sales" name="Sales" stackId="a" fill="#06b6a4" radius={[6,6,0,0]} />
                    <Bar dataKey="expenses" name="Expenses" stackId="a" fill="#f44336" radius={[6,6,0,0]} />
                  </ReBarChart>
                </ResponsiveContainer>
              )},
              { key: 'expBreak', icon: 'pie_chart', title: 'Expense Breakdown', node: (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={processed?.expBreakdown || []} dataKey="value" nameKey="name" outerRadius={90} label paddingAngle={2}>
                      {(processed?.expBreakdown || []).map((entry, idx) => (
                        <Cell key={idx} fill={["#4caf50", "#ff9800", "#2196f3", "#9c27b0"][idx % 4]} />
                      ))}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )},
              { key: 'ppPautang', icon: 'account_balance_wallet', title: 'Point Person — Pautang vs Collections', node: (
                <ResponsiveContainer width="100%" height={240}>
                  <ReBarChart data={processed?.ppPautangVsCollect || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="pautang" name="Pautang" stackId="a" fill="#f44336" />
                    <Bar dataKey="collect" name="Collected" stackId="a" fill="#4caf50" />
                  </ReBarChart>
                </ResponsiveContainer>
              )},
              { key: 'cashShift', icon: 'balance', title: 'Cash Difference per Shift', node: (
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%'}}>No shift data available</div>
              )},
            ].map((c) => (
              <ChartCard key={c.key} icon={c.icon} title={c.title} full={c.full}>
                {c.node}
              </ChartCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
