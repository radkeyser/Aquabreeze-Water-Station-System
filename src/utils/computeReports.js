export function computeProcessed(data = {}, dateFilter = 'today', customFrom = '', customTo = '') {
  if (!data) return null;

  const sales = (data.sales || []).filter((r) => inRange(r.date, dateFilter, customFrom, customTo));
  const cashDrawer = data.cashDrawer || [];
  const expRowsRaw = (cashDrawer || []).filter((r) => r.type === 'out' && !/advance/i.test(r.description || '') && inRange(r.date, dateFilter, customFrom, customTo));
  const collections = (cashDrawer || []).filter((r) => r.type === 'in' && inRange(r.date, dateFilter, customFrom, customTo));
  const pautang = (data.pautang || []).filter((r) => inRange(r.date, dateFilter, customFrom, customTo));
  const advances = (cashDrawer || []).filter((r) => /advance/i.test(r.description || '') && inRange(r.date, dateFilter, customFrom, customTo));

  const totalSales = sales.reduce((s,r) => s + (Number(r.total_amount||r.total || 0)), 0);
  const totalOrders = Array.from(new Set(sales.map((s) => s.order_id))).length;
  const totalExpense = expRowsRaw.reduce((s,r) => s + (Number(r.amount||0)), 0);
  const totalUtang = pautang.reduce((s,r) => s + (Number(r.amount||0)), 0);
  const totalCollect = collections.reduce((s,r) => s + (Number(r.amount||0)), 0);
  const totalAdv = advances.reduce((s,r) => s + (Number(r.amount||0)), 0);

  const salesByProdMap = {};
  sales.forEach((r) => {
    let name = r.product || 'Unknown';
    if (name === '5 Gallon') {
      const sp = String(r.slim_poly || '').toLowerCase();
      if (sp === 'slim') name = '5 Gallon (Slim)';
      else if (sp === 'poly') name = '5 Gallon (Poly)';
    }
    if (!salesByProdMap[name]) salesByProdMap[name] = { name, qty: 0, total: 0 };
    salesByProdMap[name].qty += Number(r.quantity || 0);
    salesByProdMap[name].total += Number(r.total_amount||r.total || 0);
  });
  const salesRows = Object.values(salesByProdMap).map((p) => ({ product: p.name, qty: p.qty, unitCost: p.qty>0 ? (p.total / p.qty).toFixed(2) : '0.00', amount: formatPeso(p.total) }));

  const expenseRows = expRowsRaw.map((e) => ({ description: e.description || '', amount: formatPeso(e.amount) }));

  const ppMap = {};
  sales.forEach((r) => {
    const pp = r.point_person || 'Walk-in';
    if (!ppMap[pp]) ppMap[pp] = { pp, total: 0, count: 0 };
    ppMap[pp].total += Number(r.total_amount||r.total||0);
    ppMap[pp].count++;
  });
  const ppRows = Object.values(ppMap).map((p) => ({ pointPerson: p.pp, count: p.count, total: formatPeso(p.total) }));

  const colMap = {};
  collections.forEach((r) => {
    const pp = r.point_person || 'Unassigned';
    if (!colMap[pp]) colMap[pp] = { pp, total: 0, count: 0 };
    colMap[pp].total += Number(r.amount || 0);
    colMap[pp].count++;
  });
  const colRows = Object.values(colMap).map((p) => ({ pointPerson: p.pp, count: p.count, total: formatPeso(p.total) }));

  const advMap = {};
  advances.forEach((r) => {
    const staff = (r.description || '').replace(/^advance\s*[-–]\s*/i, '').trim() || (r.point_person || 'Unknown');
    if (!advMap[staff]) advMap[staff] = { name: staff, amount: 0 };
    advMap[staff].amount += Number(r.amount || 0);
  });
  const advRows = Object.values(advMap).map((a) => ({ staff: a.name, amount: formatPeso(a.amount) }));

  const salesByDate = {};
  sales.forEach((r) => { if (!r.date) return; if (!salesByDate[r.date]) salesByDate[r.date] = 0; salesByDate[r.date] += Number(r.total_amount||r.total||0); });
  const salesTrend = Object.keys(salesByDate).sort().map((d) => ({ date: d, value: salesByDate[d] }));

  const statusCount = { Paid: 0, Partial: 0, Utang: 0 };
  sales.forEach((r) => { const s = r.status || 'Utang'; if (statusCount[s] !== undefined) statusCount[s]++; else statusCount[s] = 1; });
  const statusPie = Object.keys(statusCount).map((k) => ({ name: k, value: statusCount[k] }));

  const expenseByDate = {};
  expRowsRaw.forEach((r) => { if (!r.date) return; if (!expenseByDate[r.date]) expenseByDate[r.date] = 0; expenseByDate[r.date] += Number(r.amount||0); });
  const expenseTrend = Object.keys(expenseByDate).sort().map((d) => ({ date: d, value: expenseByDate[d] }));

  const mergedDates = Array.from(new Set([...(salesTrend||[]).map(s=>s.date), ...(expenseTrend||[]).map(e=>e.date)])).sort();
  const salesVsExpenses = mergedDates.map((d) => ({ date: d, sales: (salesTrend.find(s=>s.date===d)?.value)||0, expenses: (expenseTrend.find(e=>e.date===d)?.value)||0 }));

  const ppChartMap = {};
  sales.forEach((r) => { const pp = r.point_person || 'Walk-in'; if (!ppChartMap[pp]) ppChartMap[pp] = 0; ppChartMap[pp] += Number(r.total_amount||r.total||0); });
  const salesByPP = Object.keys(ppChartMap).map((k) => ({ name: k, value: ppChartMap[k] }));

  const collectChartMap = {};
  collections.forEach((r) => { const pp = r.point_person || 'Unassigned'; if (!collectChartMap[pp]) collectChartMap[pp] = 0; collectChartMap[pp] += Number(r.amount||0); });
  const collectByPP = Object.keys(collectChartMap).map((k) => ({ name: k, value: collectChartMap[k] }));

  const advChartMap = {};
  advances.forEach((r) => { const staff = (r.description || '').replace(/^advance\s*[-–]\s*/i, '').trim() || (r.point_person || 'Unknown'); if (!advChartMap[staff]) advChartMap[staff] = 0; advChartMap[staff] += Number(r.amount || 0); });
  const advByPP = Object.keys(advChartMap).map((k) => ({ name: k, value: advChartMap[k] }));

  const expBreakMap = {};
  expRowsRaw.forEach((r) => { const k = (r.description || 'Other'); if (!expBreakMap[k]) expBreakMap[k] = 0; expBreakMap[k] += Number(r.amount || 0); });
  const expBreakdown = Object.keys(expBreakMap).map((k) => ({ name: k, value: expBreakMap[k] }));

  const ppPautangMap = {};
  pautang.forEach((r) => { const pp = r.point_person || 'Unassigned'; if (!ppPautangMap[pp]) ppPautangMap[pp] = { pautang:0, collect:0 }; ppPautangMap[pp].pautang += Number(r.amount||0); });
  collections.forEach((r) => { const pp = r.point_person || 'Unassigned'; if (!ppPautangMap[pp]) ppPautangMap[pp] = { pautang:0, collect:0 }; ppPautangMap[pp].collect += Number(r.amount||0); });
  const ppPautangVsCollect = Object.keys(ppPautangMap).map((k) => ({ name: k, pautang: ppPautangMap[k].pautang, collect: ppPautangMap[k].collect }));

  return {
    totalSales, totalOrders, totalExpense, totalUtang, totalCollect, totalAdv,
    salesRows, expenseRows, ppRows, colRows, advRows,
    salesTrend, statusPie,
    expenseTrend, salesVsExpenses, salesByPP, collectByPP, advByPP, expBreakdown, ppPautangVsCollect,
  };
}

function formatPeso(amount) { return '₱' + Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function inRange(dateStr, dateFilter, customFrom, customTo) {
  if (!dateStr) return false;
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  const now = new Date(); now.setHours(0,0,0,0);
  if (dateFilter === 'today') return d.getTime() === now.getTime();
  if (dateFilter === 'week') { const w = new Date(now); w.setDate(now.getDate()-6); return d >= w && d <= now; }
  if (dateFilter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (dateFilter === 'custom' && customFrom && customTo) {
    const f = new Date(customFrom); f.setHours(0,0,0,0); const t = new Date(customTo); t.setHours(23,59,59,999);
    return d >= f && d <= t;
  }
  return true;
}
