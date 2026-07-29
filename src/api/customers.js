import { supabase } from '../supabaseClient';
import { formatDate, formatTime } from '../utils/format';

export function buildUnchargedUtangMap(pautangRows) {
  const map = {};
  (pautangRows || []).forEach((row) => {
    const custId = String(row.customer_id || '');
    const amount = Number(row.amount) || 0;
    const status = String(row.status || '').toLowerCase();
    const chargeStatus = String(row.charge_status || '').toLowerCase();
    if (!custId || status === 'paid' || chargeStatus === 'yes') return;
    map[custId] = (map[custId] || 0) + amount;
  });
  return map;
}

export function buildLastOrderDateMap(salesRows) {
  const map = {};
  (salesRows || []).forEach((row) => {
    const key = `${String(row.customer_name || '').toLowerCase()}|${String(row.location || '').toLowerCase()}`;
    const ts = new Date(row.date).getTime();
    if (!ts) return;
    if (!map[key] || ts > map[key]) map[key] = ts;
  });
  return map;
}

function mapCustomer(row, unchargedMap, lastOrderMap, cutoffMs) {
  const id = String(row.customer_id);
  const name = String(row.name || '');
  const location = String(row.location || '');
  const key = `${name.toLowerCase()}|${location.toLowerCase()}`;
  const lastOrderTs = lastOrderMap[key] || 0;
  return {
    id,
    name,
    location,
    pointPerson: String(row.point_person || ''),
    utang: unchargedMap[id] ?? 0,
    gallon: Number(row.gallon) || 0,
    dispenser: Number(row.dispenser) || 0,
    overrideOn: row.override === true,
    override5gal: Number(row.override_5gal) || 0,
    override500: Number(row.override_500ml) || 0,
    override1000: Number(row.override_1000ml) || 0,
    lastOrderDate: lastOrderTs ? formatDate(new Date(lastOrderTs)) : '',
    isActive: lastOrderTs >= cutoffMs,
  };
}

export async function getCustomers() {
  const [custRes, pautangRes, salesRes] = await Promise.all([
    supabase.from('customers').select('*').order('name', { ascending: true }),
    supabase.from('pautang').select('customer_id,customer_name,amount,status,charge_status'),
    supabase.from('sales').select('customer_name,location,date'),
  ]);

  if (custRes.error) throw custRes.error;
  if (pautangRes.error) throw pautangRes.error;
  if (salesRes.error) throw salesRes.error;

  const unchargedMap = buildUnchargedUtangMap(pautangRes.data || []);
  const lastOrderMap = buildLastOrderDateMap(salesRes.data || []);
  const cutoffMs = Date.now() - 14 * 24 * 60 * 60 * 1000;
  return (custRes.data || []).map((row) => mapCustomer(row, unchargedMap, lastOrderMap, cutoffMs));
}

export async function getStaff() {
  const { data, error } = await supabase
    .from('staff')
    .select('staff_id,name,role')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.staff_id,
    name: row.name,
    role: row.role || '',
  }));
}

export async function getDefaultProductPrices() {
  const { data, error } = await supabase
    .from('products')
    .select('product_id,price')
    .in('product_id', ['PROD-000001', 'PROD-000002', 'PROD-000004']);

  if (error) throw error;

  const prices = { gal5: 0, ml500: 0, ml1000: 0 };
  (data || []).forEach((row) => {
    const id = String(row.product_id).trim();
    if (id === 'PROD-000001') prices.gal5 = Number(row.price) || 0;
    if (id === 'PROD-000002') prices.ml1000 = Number(row.price) || 0;
    if (id === 'PROD-000004') prices.ml500 = Number(row.price) || 0;
  });
  return prices;
}

export async function addCustomer(data) {
  const { data: result, error } = await supabase.rpc('add_customer', { data });
  if (error) throw error;
  return result;
}

export async function updateCustomer(customerId, data) {
  const { data: result, error } = await supabase.rpc('update_customer', {
    p_customer_id: customerId,
    data,
  });
  if (error) throw error;
  return result;
}

export async function deleteCustomer(customerId) {
  const { data: result, error } = await supabase.rpc('delete_customer', {
    p_customer_id: customerId,
  });
  if (error) throw error;
  return result;
}

export async function processReturn(payload) {
  const { data: result, error } = await supabase.rpc('process_return', { payload });
  if (error) throw error;
  return result;
}

export async function getCustomerOrders(customerName, customerId) {
  const [pautangRes, salesRes, cashRes] = await Promise.all([
    supabase.from('pautang').select('*'),
    supabase.from('sales').select('order_id,product,quantity,total_amount,amount_paid,slim_poly'),
    supabase.from('cash_drawer').select('date,time,type,order_id,description,amount'),
  ]);

  if (pautangRes.error) throw pautangRes.error;
  if (salesRes.error) throw salesRes.error;
  if (cashRes.error) throw cashRes.error;

  const salesMap = {};
  (salesRes.data || []).forEach((sr) => {
    if (!sr.order_id) return;
    salesMap[String(sr.order_id)] = sr;
  });

  const nameLc = customerName.toLowerCase();
  const orders = [];

  (pautangRes.data || []).forEach((pRow) => {
    const pCustomerName = String(pRow.customer_name || '');
    const pCustomerId = String(pRow.customer_id || '');
    const pStatus = String(pRow.status || '').toLowerCase();
    const pChargeStatus = String(pRow.charge_status || '').toLowerCase();

    const matches = (customerId && pCustomerId === customerId)
      || pCustomerName.toLowerCase() === nameLc;
    if (!matches || pStatus === 'paid' || pChargeStatus === 'yes') return;

    const orderId = String(pRow.order_id);
    const sale = salesMap[orderId] || {};
    const payments = [];

    (cashRes.data || []).forEach((cr) => {
      if (String(cr.order_id) !== orderId) return;
      if (String(cr.type || '').toLowerCase() !== 'in') return;
      payments.push({
        date: formatDate(cr.date),
        time: cr.time ? formatTime(cr.time) : '',
        description: String(cr.description || ''),
        amount: Number(cr.amount) || 0,
      });
    });

    orders.push({
      id: orderId,
      date: formatDate(pRow.date),
      product: sale.product || '—',
      qty: Number(sale.quantity) || 0,
      slimPoly: String(sale.slim_poly || ''),
      originalTotal: Number(sale.total_amount) || 0,
      originalPaid: Number(sale.amount_paid) || 0,
      remaining: Number(pRow.amount) || 0,
      status: String(pRow.status || ''),
      pointPerson: String(pRow.point_person || ''),
      payments,
    });
  });

  return orders;
}

export async function getCustomerBorrows(customerId) {
  const [borrowRes, custRes] = await Promise.all([
    supabase.from('borrowed').select('*').eq('customer_id', customerId),
    supabase.from('customers').select('gallon,dispenser').eq('customer_id', customerId).maybeSingle(),
  ]);

  if (borrowRes.error) throw borrowRes.error;
  if (custRes.error) throw custRes.error;

  const currentGallon = Number(custRes.data?.gallon) || 0;
  const currentDispenser = Number(custRes.data?.dispenser) || 0;

  const borrowRows = [];
  const returnRows = [];

  (borrowRes.data || []).forEach((row) => {
    const obj = {
      borrowId: String(row.borrow_id),
      date: formatDate(row.date),
      gallon: Number(row.gallon) || 0,
      dispenser: Number(row.dispenser) || 0,
      status: String(row.borrow_status || ''),
    };
    if (obj.status === 'Returned') returnRows.push(obj);
    else borrowRows.push(obj);
  });

  let returnPoolGallon = 0;
  let returnPoolDispenser = 0;
  returnRows.forEach((r) => {
    returnPoolGallon += Math.abs(r.gallon);
    returnPoolDispenser += Math.abs(r.dispenser);
  });

  const result = [];
  borrowRows.forEach((b) => {
    let remainingGallon = b.gallon;
    let remainingDispenser = b.dispenser;

    if (returnPoolGallon > 0 && remainingGallon > 0) {
      const d = Math.min(returnPoolGallon, remainingGallon);
      remainingGallon -= d;
      returnPoolGallon -= d;
    }
    if (returnPoolDispenser > 0 && remainingDispenser > 0) {
      const dd = Math.min(returnPoolDispenser, remainingDispenser);
      remainingDispenser -= dd;
      returnPoolDispenser -= dd;
    }

    const returnedGallon = b.gallon - remainingGallon;
    const returnedDispenser = b.dispenser - remainingDispenser;
    if (remainingGallon === 0 && remainingDispenser === 0) return;

    result.push({
      borrowId: b.borrowId,
      date: b.date,
      originalGallon: b.gallon,
      originalDispenser: b.dispenser,
      returnedGallon,
      returnedDispenser,
      remainingGallon,
      remainingDispenser,
    });
  });

  return { borrows: result, currentGallon, currentDispenser };
}

export { getShiftStatus, getDeliveryBoys } from './pautang.js';
export { payPautang } from './pautang.js';
