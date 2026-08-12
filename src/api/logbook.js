import { supabase } from '../supabaseClient';
import { formatDate, formatTime } from '../utils/format';

function mapEntry(row) {
  return {
    logId: row.log_id,
    orderId: row.order_id || '',
    date: row.date,
    time: row.time ? formatTime(row.time) : '',
    customerName: row.customer_name || '',
    location: row.location || '',
    pointPerson: row.point_person || '',
    product: row.product || '',
    qty: Number(row.qty) || 0,
    status: row.status || 'Undelivered',
    deliveredTime: row.delivered_time ? formatTime(row.delivered_time) : '',
    deliveredQty: Number(row.qty_delivered) || 0,
    deliveredDate: row.delivered_date ? formatDate(row.delivered_date) : '',
    linkedLogId: row.linked_log_id || '',
    tip: Number(row.tip) || 0,
    notes: row.notes || '',
    tipClaimed: !!row.tip_claimed,
    deliveryAttempts: Number(row.delivery_attempts) || 0,
  };
}

export async function getLogbookData() {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);

  const [logRes, staffRes, prodRes, pautangRes] = await Promise.all([
    supabase.from('logbook').select('*').or(`status.neq.Delivered,date.gte.${yesterdayStr}`),
    supabase.from('staff').select('staff_id,name,role').ilike('role', 'delivery boy').order('name'),
    supabase.from('products').select('name,type').eq('type', 'Product'),
    supabase.from('pautang').select('order_id,amount,status,charge_status'),
  ]);

  if (logRes.error) throw logRes.error;
  if (staffRes.error) throw staffRes.error;
  if (prodRes.error) throw prodRes.error;
  if (pautangRes.error) throw pautangRes.error;

  const paymentMap = {};
  (pautangRes.data || []).forEach((p) => {
    if (String(p.charge_status || 'No').toLowerCase() === 'yes') return;
    paymentMap[p.order_id] = { balance: Number(p.amount) || 0, status: p.status || '' };
  });

  const entries = (logRes.data || []).map(mapEntry);

  entries.forEach((e) => {
    const sibling = e.linkedLogId ? entries.find((s) => s.logId === e.linkedLogId) : null;
    const isClosedHalf = e.status === 'Delivered' && sibling && sibling.status !== 'Delivered';
    if (isClosedHalf) {
      e.paymentStatus = 'Paid';
      e.paymentBalance = 0;
      e.isClosedSplitHalf = true;
    } else {
      const p = paymentMap[e.orderId];
      e.paymentStatus = p ? p.status : 'Paid';
      e.paymentBalance = p ? p.balance : 0;
      e.isClosedSplitHalf = false;
    }
  });

  const staff = (staffRes.data || []).map((s) => ({ id: s.staff_id, name: s.name }));
  const products = (prodRes.data || []).map((p) => p.name).filter(Boolean);

  return { entries, staff, products };
}

export async function markLogbookDelivered(logId, status, deliveredQty = 0) {
  const { data, error } = await supabase.rpc('mark_logbook_delivered', {
    p_log_id: logId,
    p_status: status,
    p_delivered_qty: deliveredQty,
  });
  if (error) throw error;
  return {
    ...data,
    deliveredTime: data.deliveredTime ? formatTime(data.deliveredTime) : '',
    deliveredDate: data.deliveredDate ? formatDate(data.deliveredDate) : '',
  };
}

export async function toggleTipClaimed(logId) {
  const { data, error } = await supabase.rpc('toggle_tip_claimed', { p_log_id: logId });
  if (error) throw error;
  return data;
}

export async function voidLogbookOrder(logId, orderId) {
  const { data, error } = await supabase.rpc('void_logbook_order', { p_log_id: logId, p_order_id: orderId });
  if (error) throw error;
  return data;
}

export async function updateLogbookPointPerson(logId, orderId, newPointPerson) {
  const { data, error } = await supabase.rpc('update_logbook_point_person', {
    p_log_id: logId,
    p_order_id: orderId,
    p_new_point_person: newPointPerson || '',
  });
  if (error) throw error;
  return data;
}

export async function splitLogbookPartialReassign(logId, orderId, newPointPerson) {
  const { data, error } = await supabase.rpc('split_logbook_partial_reassign', {
    p_log_id: logId,
    p_order_id: orderId,
    p_new_point_person: newPointPerson || '',
  });
  if (error) throw error;
  if (data?.newEntry?.time) data.newEntry.time = formatTime(data.newEntry.time);
  return data;
}

export { payPautang } from './pautang.js';

export default {
  getLogbookData,
  markLogbookDelivered,
  toggleTipClaimed,
  voidLogbookOrder,
  updateLogbookPointPerson,
  splitLogbookPartialReassign,
};