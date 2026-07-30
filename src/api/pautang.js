import { supabase } from '../supabaseClient';
import { formatDate, formatTime } from '../utils/format';

function buildLookupMaps(salesRows, cashRows) {
  const salesMap = {};
  salesRows.forEach((sr) => {
    if (!sr.order_id) return;
    salesMap[String(sr.order_id)] = {
      time: sr.time ? formatTime(sr.time) : '',
      product: String(sr.product || ''),
      qty: Number(sr.quantity) || 0,
      location: String(sr.location || ''),
      orderTotal: Number(sr.total_amount) || 0,
      amountPaid: Number(sr.amount_paid) || 0,
      slimPoly: String(sr.slim_poly || ''),
    };
  });

  const historyMap = {};
  cashRows.forEach((cr) => {
    if (!cr.id) return;
    const type = String(cr.type || '').toLowerCase();
    const desc = String(cr.description || '').toLowerCase();
    if (type !== 'in' || !desc.includes('pautang payment')) return;
    const oid = String(cr.order_id || '');
    if (!oid) return;
    if (!historyMap[oid]) historyMap[oid] = [];
    historyMap[oid].push({
      date: formatDate(cr.date),
      time: cr.time ? formatTime(cr.time) : '',
      description: String(cr.description || ''),
      amount: Number(cr.amount) || 0,
    });
  });

  return { salesMap, historyMap };
}

export function mergePautangRows(pautangRows, salesMap, historyMap) {
  const mergeMap = {};

  pautangRows.forEach((row) => {
    const chargeStatus = String(row.charge_status || 'No').toLowerCase();
    if (chargeStatus === 'yes') return;

    const orderId = String(row.order_id);
    const date = formatDate(row.date);
    const customerName = String(row.customer_name || '');
    const amount = Number(row.amount) || 0;
    const sale = salesMap[orderId] || {};
    const product = sale.product || '';
    const slimPoly = sale.slimPoly || '';
    const history = historyMap[orderId] || [];
    const status = String(row.status || '');

    const mergeKey = `${customerName.toLowerCase()}|${product.toLowerCase()}|${slimPoly.toLowerCase()}|${date}`;

    const initialPaid = sale.amountPaid || 0;
    const cashPaid = history.reduce((s, h) => s + h.amount, 0);
    const orderHistory = [];

    if (initialPaid > 0 && initialPaid > cashPaid) {
      orderHistory.push({
        date,
        time: sale.time || '',
        description: 'Initial Payment (at sale)',
        amount: initialPaid,
      });
    }
    history.forEach((h) => orderHistory.push(h));

    const originalTotal = sale.orderTotal || amount;
    const totalPaidSoFar = originalTotal - amount;
    const hasHistory = orderHistory.length > 0;

    const individualOrder = {
      id: orderId,
      pautangId: String(row.pautang_id || ''),
      date,
      time: sale.time || (row.time ? formatTime(row.time) : ''),
      status,
      product,
      qty: sale.qty || 0,
      slimPoly,
      orderTotal: originalTotal,
      alreadyPaid: totalPaidSoFar,
      amount,
      pointPerson: String(row.point_person || ''),
      payHistory: orderHistory,
    };

    if (mergeMap[mergeKey]) {
      const existing = mergeMap[mergeKey];
      existing.amount += amount;
      existing.orderTotal += originalTotal;
      existing.alreadyPaid += totalPaidSoFar;
      existing.qty += sale.qty || 0;
      existing.orderIds.push(orderId);
      existing.orders.push(individualOrder);
      orderHistory.forEach((h) => existing.payHistory.push(h));
      if (hasHistory && !existing._hasHistory) {
        existing.id = orderId;
        existing._hasHistory = true;
      }
      const st = status.toLowerCase();
      if (st === 'utang') existing.status = 'Utang';
      else if (st === 'partial' && existing.status.toLowerCase() !== 'utang') existing.status = 'Partial';
    } else {
      mergeMap[mergeKey] = {
        id: orderId,
        pautangId: String(row.pautang_id || ''),
        _hasHistory: hasHistory,
        orderIds: [orderId],
        orders: [individualOrder],
        date,
        customerName,
        customerId: String(row.customer_id || ''),
        amount,
        pointPerson: String(row.point_person || ''),
        status,
        chargeStatus: String(row.charge_status || 'No'),
        product,
        qty: sale.qty || 0,
        slimPoly,
        location: sale.location || '',
        orderTotal: originalTotal,
        alreadyPaid: totalPaidSoFar,
        payHistory: orderHistory.slice(),
      };
    }
  });

  const result = Object.values(mergeMap);
  result.sort((a, b) => {
    const na = parseInt((String(a.id || '').match(/(\d+)$/) || [0, 0])[1], 10);
    const nb = parseInt((String(b.id || '').match(/(\d+)$/) || [0, 0])[1], 10);
    return nb - na;
  });
  return result;
}

export async function getMergedPautang() {
  const [pautangRes, salesRes, cashRes] = await Promise.all([
    supabase.from('pautang').select('*'),
    supabase.from('sales').select('order_id,date,time,location,product,quantity,total_amount,amount_paid,slim_poly'),
    supabase.from('cash_drawer').select('id,date,time,type,order_id,description,amount'),
  ]);

  if (pautangRes.error) throw pautangRes.error;
  if (salesRes.error) throw salesRes.error;
  if (cashRes.error) throw cashRes.error;

  const { salesMap, historyMap } = buildLookupMaps(salesRes.data || [], cashRes.data || []);
  return mergePautangRows(pautangRes.data || [], salesMap, historyMap);
}

export async function getDeliveryBoys() {
  const { data, error } = await supabase
    .from('staff')
    .select('staff_id,name,role')
    .ilike('role', 'delivery boy')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => ({ id: row.staff_id, name: row.name }));
}

export async function getShiftStatus() {
  const { data, error } = await supabase
    .from('shift')
    .select('shift_id,status')
    .eq('status', 'Open')
    .order('date', { ascending: false })
    .order('time', { ascending: false })
    .limit(1);

  if (error) throw error;
  return { isOpen: (data || []).length > 0, shift: data?.[0] || null };
}

export async function payPautang(orderIds, amountPaid, paymentMethod = 'Cash') {
  const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
  const { data, error } = await supabase.rpc('pay_pautang', {
    order_ids: ids,
    amount_paid: amountPaid,
    payment_method: paymentMethod === 'GCash' ? 'GCash' : 'Cash',
  });

  if (error) throw error;
  return data;
}

export async function updatePautangPointPerson(orderIds, newPointPerson) {
  const ids = Array.isArray(orderIds) ? orderIds : [orderIds];
  const { data, error } = await supabase.rpc('update_pautang_point_person', {
    order_ids: ids,
    new_point_person: newPointPerson || '',
  });

  if (error) throw error;
  return data;
}

export function filterPautangClientSide(allData, dateFilter, ppFilter, customFrom, customTo) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  return (allData || []).filter((c) => {
    if (ppFilter && String(c.pointPerson || '').toLowerCase() !== ppFilter.toLowerCase()) return false;
    if (dateFilter === 'all') return true;

    const d = new Date(c.date);
    if (Number.isNaN(d.getTime())) return false;
    d.setHours(0, 0, 0, 0);

    if (dateFilter === 'today') return d.getTime() === now.getTime();
    if (dateFilter === 'week') {
      const w = new Date(now);
      w.setDate(now.getDate() - 6);
      return d >= w && d <= now;
    }
    if (dateFilter === 'month') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }
    if (dateFilter === 'custom' && customFrom && customTo) {
      const f = new Date(customFrom);
      f.setHours(0, 0, 0, 0);
      const t = new Date(customTo);
      t.setHours(23, 59, 59, 999);
      return d >= f && d <= t;
    }
    return true;
  });
}

export default {
  getMergedPautang,
  getDeliveryBoys,
  getShiftStatus,
  payPautang,
  updatePautangPointPerson,
  filterPautangClientSide,
  mergePautangRows,
};
