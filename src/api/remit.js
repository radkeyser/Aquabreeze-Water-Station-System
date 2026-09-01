import { supabase } from '../supabaseClient';
import { formatDate, formatTime } from '../utils/format';

export async function getRemitData() {
  const [logRes, salesRes, pautangRes] = await Promise.all([
    supabase.from('logbook').select('order_id,status,customer_name,location,product,qty,point_person,date,time,delivered_date,delivered_time'),
    supabase.from('sales').select('order_id,total_amount,amount_paid,product,quantity,slim_poly,status'),
    supabase.from('pautang').select('*'),
  ]);
  if (logRes.error) throw logRes.error;
  if (salesRes.error) throw salesRes.error;
  if (pautangRes.error) throw pautangRes.error;

  const logByOrder = {};
  (logRes.data || []).forEach((row) => {
    if (!row.order_id) return;
    if (!logByOrder[row.order_id]) logByOrder[row.order_id] = [];
    logByOrder[row.order_id].push(row);
  });

  const salesMap = {};
  (salesRes.data || []).forEach((s) => { if (s.order_id) salesMap[s.order_id] = s; });

  const pautangMap = {};
  (pautangRes.data || []).forEach((p) => { if (p.order_id) pautangMap[p.order_id] = p; });

  const entries = [];
  Object.entries(logByOrder).forEach(([orderId, rows]) => {
    const eligibleRows = rows.filter((r) => r.status === 'Delivered' || r.status === 'Partial');
    if (!eligibleRows.length) return;

    const sale = salesMap[orderId] || {};
    if (String(sale.status || '').toLowerCase() === 'void') return;

    // Represent the order by whichever eligible row was delivered most
    // recently — matters for split/reassigned orders with multiple rows.
    const repRow = eligibleRows.reduce((latest, r) => {
      if (!latest) return r;
      const rKey = `${r.delivered_date || ''} ${r.delivered_time || ''}`;
      const lKey = `${latest.delivered_date || ''} ${latest.delivered_time || ''}`;
      return rKey > lKey ? r : latest;
    }, null);

    const pautang = pautangMap[orderId];
    const chargedOff = pautang && String(pautang.charge_status || 'No').toLowerCase() === 'yes';

    let paymentStatus = 'Paid';
    let balance = 0;
    if (pautang && !chargedOff) {
      paymentStatus = pautang.status || 'Utang';
      balance = Number(pautang.amount) || 0;
    }

    entries.push({
      orderId,
      customerName: repRow.customer_name || sale.customer_name || '',
      location: repRow.location || '',
      product: sale.product || repRow.product || '',
      qty: Number(sale.quantity ?? repRow.qty) || 0,
      slimPoly: sale.slim_poly || '',
      total: Number(sale.total_amount) || 0,
      alreadyPaid: Number(sale.amount_paid) || 0,
      orderDate: formatDate(repRow.date),
      pointPerson: repRow.point_person || '',
      deliveredDate: repRow.delivered_date || '', // raw ISO date, for filtering
      deliveredDateDisplay: repRow.delivered_date ? formatDate(repRow.delivered_date) : '',
      deliveredTime: repRow.delivered_time ? formatTime(repRow.delivered_time) : '',
      deliveryStatus: eligibleRows.some((r) => r.status === 'Delivered') ? 'Delivered' : 'Partial',
      paymentStatus,
      balance,
    });
  });

  entries.sort((a, b) => new Date(b.deliveredDate || 0) - new Date(a.deliveredDate || 0));
  return entries;
}

export async function getRemitHistory() {
  const { data, error } = await supabase
    .from('remit_history')
    .select('*')
    .order('date', { ascending: false })
    .order('time', { ascending: false });
  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    orderId: row.order_id,
    customerName: row.customer_name || '',
    pointPerson: row.point_person || '',
    amount: Number(row.amount) || 0,
    paymentMethod: row.payment_method || 'Cash',
    label: row.label || 'Pautang Payment',
    date: formatDate(row.date),
    rawDate: row.date,
    time: row.time ? formatTime(row.time) : '',
  }));
}

export async function getPointPersonList() {
  const { data, error } = await supabase.from('staff').select('staff_id,name').order('name');
  if (error) throw error;
  return (data || []).map((s) => s.name).filter(Boolean);
}

export async function remitOrderPayment(orderId, amount, paymentMethod = 'Cash') {
  const { data, error } = await supabase.rpc('remit_order_payment', {
    p_order_id: orderId,
    p_amount: amount,
    p_payment_method: paymentMethod === 'GCash' ? 'GCash' : 'Cash',
  });
  if (error) throw error;
  return data;
}

export default { getRemitData, getRemitHistory, getPointPersonList, remitOrderPayment };