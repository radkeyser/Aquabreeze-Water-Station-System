import { supabase } from '../supabaseClient';
import { formatDate, formatTime } from '../utils/format';

export const INV_PRODUCTS = ['500 mL', '1000 mL', 'Slim Gallon'];
export const INV_BAG_SIZES = { '500 mL': 200, '1000 mL': 113, 'Slim Gallon': 1 };
export const INV_LOW_STOCK = { '500 mL': 500, '1000 mL': 500, 'Slim Gallon': 10 };
export const OTHER_PRODUCTS = ['6L', '7L', '8L', '10L'];

const INV_PRODUCT_ID_MAP = {
  'PROD-000004': '500 mL',
  'PROD-000002': '1000 mL',
  'PROD-000003': '1000 mL',
  'PROD-000005': 'Slim Gallon',
};

function resolveBucket(productName, productId) {
  const id = String(productId || '').trim();
  if (id && INV_PRODUCT_ID_MAP[id]) return INV_PRODUCT_ID_MAP[id];
  const name = String(productName || '').trim();
  return INV_BAG_SIZES[name] !== undefined ? name : null;
}

export async function getActiveShiftId() {
  const { data, error } = await supabase.rpc('get_active_shift_id');
  if (error) throw error;
  return data || '';
}

async function getLastDailyInventory(product) {
  const { data, error } = await supabase
    .from('daily_inventory')
    .select('actual_bag,actual_bottle,total_actual,date')
    .eq('product', product)
    .order('date', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  return row
    ? { actualBag: Number(row.actual_bag) || 0, actualBottles: Number(row.actual_bottle) || 0, totalActual: Number(row.total_actual) || 0, date: row.date }
    : { actualBag: 0, actualBottles: 0, totalActual: 0, date: '' };
}

async function getPendingSalesByProduct() {
  const { data, error } = await supabase.from('sales').select('product,product_id,quantity,recorded');
  if (error) throw error;
  const result = {};
  INV_PRODUCTS.forEach((p) => { result[p] = 0; });
  (data || []).forEach((row) => {
    if (String(row.recorded || '').toLowerCase() === 'yes') return;
    const bucket = resolveBucket(row.product, row.product_id);
    if (bucket) result[bucket] += Number(row.quantity) || 0;
  });
  return result;
}

async function getPendingDeliveriesByProduct(dateStr) {
  const { data, error } = await supabase.from('delivery').select('date,product,bags,piece_per_bag,status');
  if (error) throw error;
  const result = {};
  INV_PRODUCTS.forEach((p) => { result[p] = 0; });
  (data || []).forEach((row) => {
    if (String(row.status || '') === 'Recorded') return;
    if (dateStr && row.date > dateStr) return;
    const ppb = Number(row.piece_per_bag) || INV_BAG_SIZES[row.product] || 1;
    if (result[row.product] !== undefined) result[row.product] += (Number(row.bags) || 0) * ppb;
  });
  return result;
}

async function getPendingBorrows() {
  const { data, error } = await supabase.from('borrowed').select('gallon,record_status');
  if (error) throw error;
  let borrowed = 0, returned = 0;
  (data || []).forEach((row) => {
    if (String(row.record_status || '').toLowerCase() === 'yes') return;
    const g = Number(row.gallon) || 0;
    if (g > 0) borrowed += g; else returned += Math.abs(g);
  });
  return { borrowed, returned };
}

// ---- Dashboard ----
export async function getInventoryDashboard() {
  const today = formatDate(new Date());
  const [pendingSales, pendingDels, { borrowed, returned }] = await Promise.all([
    getPendingSalesByProduct(),
    getPendingDeliveriesByProduct(today),
    getPendingBorrows(),
  ]);

  const products = [];
  const alerts = [];

  for (const p of INV_PRODUCTS) {
    const prev = await getLastDailyInventory(p);
    const bagSize = INV_BAG_SIZES[p] || 1;
    const isSlim = p === 'Slim Gallon';
    const begTotal = isSlim ? prev.totalActual : prev.actualBag * bagSize + prev.actualBottles;
    const delBtl = pendingDels[p] || 0;
    const sales = pendingSales[p] || 0;
    const expected = isSlim ? begTotal + delBtl - sales - borrowed + returned : begTotal + delBtl - sales;

    products.push({
      name: p,
      unit: bagSize > 1 ? `${bagSize} pcs/bag` : 'unit',
      beginning: begTotal,
      deliveries: delBtl,
      sales,
      borrowed: isSlim ? borrowed : 0,
      returned: isSlim ? returned : 0,
      expectedEnding: expected,
    });

    if (expected < (INV_LOW_STOCK[p] || 0)) {
      alerts.push({ type: 'low', message: `⚠ Low stock: ${p} — only ${expected} bottles expected ending.` });
    }
  }

  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yStr = formatDate(yesterday);
  const { data: yData } = await supabase.from('daily_inventory').select('date').eq('date', yStr).limit(1);
  if (!yData?.length) alerts.push({ type: 'missing', message: `⚠ Daily Inventory for ${yStr} not yet entered.` });

  const trend = await getInventoryTrend(14);
  return { products, alerts, trend };
}

async function getInventoryTrend(days) {
  const now = new Date();
  const fromDate = new Date(now); fromDate.setDate(now.getDate() - days + 1);
  const fromStr = formatDate(fromDate);

  const [{ data: delData }, { data: invData }] = await Promise.all([
    supabase.from('delivery').select('date,product,bags,piece_per_bag').gte('date', fromStr),
    supabase.from('daily_inventory').select('date,variance').gte('date', fromStr),
  ]);

  const trend = [];
  for (let d = days - 1; d >= 0; d--) {
    const day = new Date(now); day.setDate(now.getDate() - d);
    const dStr = formatDate(day);
    const purchases = (delData || []).filter((r) => r.date === dStr)
      .reduce((s, r) => s + (Number(r.bags) || 0) * (Number(r.piece_per_bag) || INV_BAG_SIZES[r.product] || 1), 0);
    const variance = (invData || []).filter((r) => r.date === dStr).reduce((s, r) => s + (Number(r.variance) || 0), 0);
    if (purchases > 0 || variance !== 0) trend.push({ date: dStr, purchases, variance });
  }
  return trend;
}

// ---- Daily Inventory Form ----
export async function getDailyInventoryFormData() {
  const today = formatDate(new Date());
  const [pendingSales, pendingDels, { borrowed, returned }] = await Promise.all([
    getPendingSalesByProduct(),
    getPendingDeliveriesByProduct(today),
    getPendingBorrows(),
  ]);

  const previous = {};
  for (const p of INV_PRODUCTS) previous[p] = await getLastDailyInventory(p);

  return {
    previous,
    deliveries: pendingDels,
    sales: pendingSales,
    borrowed: { 'Slim Gallon': { borrow: borrowed, returned } },
    date: today,
  };
}

export async function saveDailyInventory(payload) {
  const { data, error } = await supabase.rpc('save_daily_inventory', {
    p_date: payload.date,
    p_products: payload.products,
  });
  if (error) throw error;
  return data;
}

// ---- Delivery ----
export async function getDeliveryHistory() {
  const [{ data: delData, error: delErr }, { data: suppData, error: suppErr }] = await Promise.all([
    supabase.from('delivery').select('*').order('date', { ascending: false }),
    supabase.from('suppliers').select('*'),
  ]);
  if (delErr) throw delErr;
  if (suppErr) throw suppErr;

  const records = (delData || []).map((r) => ({
    id: r.delivery_id,
    date: r.date,
    time: r.time ? formatTime(r.time) : '',
    supplier: r.supplier || '',
    product: r.product || '',
    bags: Number(r.bags) || 0,
    piecePerBag: Number(r.piece_per_bag) || 0,
    discount: Number(r.discount) || 0,
    additional: Number(r.additional) || 0,
    totalCost: Number(r.total_cost) || 0,
    mop: r.mop || '',
    notes: r.notes || '',
    status: r.status || 'Not Yet Recorded',
  }));

  const suppliers = (suppData || []).map((s) => {
    const products = {};
    if (Number(s.qty_500ml) > 0) products['500 mL'] = { qty: Number(s.qty_500ml), price: Number(s.price_500ml) || 0 };
    if (Number(s.qty_1000ml) > 0) products['1000 mL'] = { qty: Number(s.qty_1000ml), price: Number(s.price_1000ml) || 0 };
    if (Number(s.qty_slim_gallon) > 0) products['Slim Gallon'] = { qty: Number(s.qty_slim_gallon), price: Number(s.price_slim_gallon) || 0 };
    return { id: s.supplier_id, name: s.supplier_name, products };
  }).filter((s) => Object.keys(s.products).length > 0);

  return { records, suppliers };
}

export async function saveDelivery(payload) {
  const { data, error } = await supabase.rpc('save_delivery', { payload });
  if (error) throw error;
  return data;
}

// ---- Variance ----
export async function getVarianceReport(timeframe, customFrom, customTo) {
  const now = new Date();
  let startDate = null, endDate = null;

  if (timeframe === 'today') { startDate = new Date(now); startDate.setHours(0, 0, 0, 0); }
  else if (timeframe === 'week') { startDate = new Date(now); startDate.setDate(now.getDate() - 6); startDate.setHours(0, 0, 0, 0); }
  else if (timeframe === 'month') { startDate = new Date(now.getFullYear(), now.getMonth(), 1); }
  else if (timeframe === 'custom' && customFrom && customTo) {
    startDate = new Date(customFrom); startDate.setHours(0, 0, 0, 0);
    endDate = new Date(customTo); endDate.setHours(23, 59, 59, 999);
  }

  const { data, error } = await supabase.from('daily_inventory').select('date,product,expected,total_actual,variance');
  if (error) throw error;

  const rows = [];
  const summary = {};
  INV_PRODUCTS.forEach((p) => { summary[p] = { total: 0 }; });

  (data || []).forEach((r) => {
    const rowDate = new Date(r.date);
    if (startDate && rowDate < startDate) return;
    if (endDate && rowDate > endDate) return;
    rows.push({ date: r.date, product: r.product, expected: Number(r.expected) || 0, actual: Number(r.total_actual) || 0, variance: Number(r.variance) || 0 });
    if (summary[r.product]) summary[r.product].total += Number(r.variance) || 0;
  });

  rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { rows, summary };
}

// ---- History ----
export async function getInventoryHistory(year, month) {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const [{ data: invData, error: invErr }, { data: delData }, { data: borrowData }] = await Promise.all([
    supabase.from('daily_inventory').select('*').gte('date', `${monthStr}-01`).lte('date', `${monthStr}-31`),
    supabase.from('delivery').select('date,status'),
    supabase.from('borrowed').select('date,gallon,borrow_status,record_status'),
  ]);
  if (invErr) throw invErr;

  const byDate = {};
  (invData || []).forEach((row) => {
    if (!byDate[row.date]) byDate[row.date] = [];
    byDate[row.date].push(row);
  });

  const records = Object.keys(byDate).sort().map((dateStr) => {
    const rows = byDate[dateStr];
    let totalVariance = 0;
    let recordTime = '';
    const products = rows.map((row) => {
      totalVariance += Number(row.variance) || 0;
      if (!recordTime && row.timestamp) { try { recordTime = formatTime(row.timestamp); } catch { /* ignore */ } }
      return {
        name: row.product,
        begBag: Number(row.beginning_bag) || 0,
        begBtl: Number(row.beginning_bottle) || 0,
        delBag: Number(row.delivery_bottles) || 0,
        available: Number(row.available) || 0,
        salesBtl: Number(row.sales_bottle) || 0,
        borrowedGal: Number(row.borrowed) || 0,
        returnedGal: Number(row.returned) || 0,
        expected: Number(row.expected) || 0,
        actualBag: Number(row.actual_bag) || 0,
        actualBtl: Number(row.actual_bottle) || 0,
        totalActual: Number(row.total_actual) || 0,
        variance: Number(row.variance) || 0,
      };
    });
    return { date: dateStr, time: recordTime, products, totalVariance, hasDelivery: false };
  });

  const deliveryDates = Array.from(new Set((delData || []).filter((r) => r.status === 'Recorded').map((r) => r.date)));
  const deliverySet = new Set(deliveryDates);
  records.forEach((r) => { r.hasDelivery = deliverySet.has(r.date); });

  const borrowMap = {};
  (borrowData || []).forEach((r) => {
    if (String(r.record_status || '').toLowerCase() === 'yes') return;
    if (!borrowMap[r.date]) borrowMap[r.date] = { borrowed: 0, returned: 0 };
    const g = Math.abs(Number(r.gallon) || 0);
    if (String(r.borrow_status || '').toLowerCase() === 'borrowed') borrowMap[r.date].borrowed += g;
    else borrowMap[r.date].returned += g;
  });
  records.forEach((r) => {
    if (borrowMap[r.date]) { r.borrowedGal = borrowMap[r.date].borrowed; r.returnedGal = borrowMap[r.date].returned; }
  });

  records.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { records, deliveryDates };
}

// ---- Meter Reading ----
export async function getMeterReadingData() {
  const today = formatDate(new Date());
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
  const yStr = formatDate(yesterday);

  const { data: invData, error: invErr } = await supabase.from('daily_inventory').select('*').in('date', [today, yStr]);
  if (invErr) throw invErr;

  let dailyCountDone = false;
  const dailyCount = {};
  (invData || []).forEach((row) => {
    dailyCountDone = true;
    const bagSize = Number(row.bag_size) || INV_BAG_SIZES[row.product] || 1;
    const isSlim = row.product === 'Slim Gallon';
    dailyCount[row.product] = {
      begTotal: isSlim ? Number(row.beginning_bag) || 0 : (Number(row.beginning_bag) || 0) * bagSize,
      delivery: Number(row.delivery_bottles) || 0,
      ending: isSlim ? Number(row.total_actual) || 0 : (Number(row.actual_bag) || 0) * bagSize,
      bagSize,
    };
  });

  const { data: mrData, error: mrErr } = await supabase
    .from('meter_reading').select('*').lt('date', today).order('date', { ascending: false }).limit(1);
  if (mrErr) throw mrErr;
  const lastMr = mrData?.[0];
  const stockBeg = lastMr ? { poly: Number(lastMr.stock_end_poly) || 0, slim: Number(lastMr.stock_end_slim) || 0 } : { poly: 0, slim: 0 };
  const meterBeg = lastMr ? Number(lastMr.meter_end) || 0 : 0;
  const convPoly = lastMr ? Number(lastMr.conv_poly) || 19.2 : 19.2;
  const convSlim = lastMr ? Number(lastMr.conv_slim) || 20.2 : 20.2;

  const { data: spData } = await supabase.from('slim_poly').select('quantity,slim_poly');
  const galSales = { poly: 0, slim: 0 };
  (spData || []).forEach((r) => {
    const sp = String(r.slim_poly || '').toLowerCase();
    if (sp === 'poly') galSales.poly += Number(r.quantity) || 0;
    else if (sp === 'slim') galSales.slim += Number(r.quantity) || 0;
  });

  const shiftId = await getActiveShiftId();
  const otherCounts = {};
  OTHER_PRODUCTS.forEach((p) => { otherCounts[p] = 0; });
  const stockSold = { poly: 0, slim: 0 };

  if (shiftId) {
    const { data: pcData } = await supabase.from('prod_count').select('product,quantity,shift_id').eq('shift_id', shiftId);
    (pcData || []).forEach((r) => { if (otherCounts[r.product] !== undefined) otherCounts[r.product] += Number(r.quantity) || 0; });

    const { data: spShift } = await supabase.from('slim_poly').select('quantity,slim_poly,shift_id').eq('shift_id', shiftId);
    (spShift || []).forEach((r) => {
      const sp = String(r.slim_poly || '').toLowerCase();
      if (sp === 'poly') stockSold.poly += Number(r.quantity) || 0;
      else if (sp === 'slim') stockSold.slim += Number(r.quantity) || 0;
    });
  }

  return { dailyCountDone, dailyCount, stockBeg, meterBeg, galSales, convPoly, convSlim, otherCounts, stockSold, date: today };
}

export async function saveMeterReading(payload) {
  const { data, error } = await supabase.rpc('save_meter_reading', { payload });
  if (error) throw error;
  return data;
}

export function fmtNum(n) {
  return Number(n || 0).toLocaleString();
}