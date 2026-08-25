import { supabase } from '../supabaseClient';
import { formatDate, formatTime } from '../utils/format';

export async function getRemitData() {
  const [logRes, salesRes, pautangRes] = await Promise.all([
    supabase.from('logbook').select('order_id,status,customer_name,location,product,qty,point_person,date,time'),
    supabase.from('sales').select('order_id,time,total_amount,amount_paid,product,quantity,slim_poly,status'),
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
    // Only orders with at least one Delivered or Partial delivery row are
    // eligible — orders where every row is still Undelivered are excluded.
    const eligible = rows.some((r) => r.status === 'Delivered' || r.status === 'Partial');
    if (!eligible) return;

    const sale = salesMap[orderId] || {};
    if (String(sale.status || '').toLowerCase() === 'void') return;

    const first = rows[0];
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
      customerName: first.customer_name || sale.customer_name || '',
      location: first.location || '',
      product: sale.product || first.product || '',
      qty: Number(sale.quantity ?? first.qty) || 0,
      slimPoly: sale.slim_poly || '',
      total: Number(sale.total_amount) || 0,
      alreadyPaid: Number(sale.amount_paid) || 0,
      date: formatDate(first.date),
      time: sale.time ? formatTime(sale.time) : (first.time ? formatTime(first.time) : ''),
      pointPerson: first.point_person || '',
      deliveryStatus: rows.some((r) => r.status === 'Delivered') ? 'Delivered' : 'Partial',
      paymentStatus,
      balance,
    });
  });

  entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  return entries;
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

export default { getRemitData, remitOrderPayment };