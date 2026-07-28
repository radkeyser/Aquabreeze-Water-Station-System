import { supabase } from '../supabaseClient';
import { formatDate, formatTime } from '../utils/format';

export function calcExpected(rate, days, advance, commission, debtCharge) {
  return (Number(rate) || 0) * (Number(days) || 0)
    - (Number(advance) || 0)
    + (Number(commission) || 0)
    - (Number(debtCharge) || 0);
}

async function getStaffCommission(name) {
  const { data, error } = await supabase.rpc('get_staff_commission', { p_name: name });
  if (error) throw error;
  return Number(data) || 0;
}

function mapPayrollRow(row, commission) {
  const daysWorked = Number(row.days_worked) || 0;
  const dailyRate = Number(row.daily_rate) || 0;
  const advance = Number(row.advance) || 0;
  const debtCharge = Number(row.debt_charge) || 0;
  const expectedSalary = calcExpected(dailyRate, daysWorked, advance, commission, debtCharge);

  return {
    id: row.staff_id,
    name: String(row.name || ''),
    role: String(row.role || ''),
    daysWorked,
    dailyRate,
    advance,
    commission,
    debtCharge,
    expectedSalary,
    status: String(row.status || 'Pending'),
    dateReleased: row.date_released ? formatDate(row.date_released) : '',
    timeReleased: row.time_released ? formatTime(row.time_released) : '',
  };
}

export async function getPayrollData() {
  const { data, error } = await supabase
    .from('payroll')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;

  const rows = data || [];
  const employees = await Promise.all(
    rows.map(async (row) => {
      const commission = await getStaffCommission(row.name);
      return mapPayrollRow(row, commission);
    })
  );

  return employees;
}

export async function getConfigRoles() {
  const { data, error } = await supabase
    .from('roles')
    .select('name')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []).map((r) => r.name);
}

export async function getPautangDebtsForStaff(staffName) {
  const [pautangRes, salesRes] = await Promise.all([
    supabase.from('pautang').select('*'),
    supabase.from('sales').select('order_id,product,quantity,slim_poly'),
  ]);

  if (pautangRes.error) throw pautangRes.error;
  if (salesRes.error) throw salesRes.error;

  const salesMap = {};
  (salesRes.data || []).forEach((sr) => {
    if (!sr.order_id) return;
    salesMap[String(sr.order_id)] = sr;
  });

  const nameLc = staffName.toLowerCase();
  const result = [];

  (pautangRes.data || []).forEach((row) => {
    if (!row.order_id) return;
    const pointPerson = String(row.point_person || '');
    const chargeStatus = String(row.charge_status || 'No').toLowerCase();
    if (pointPerson.toLowerCase() !== nameLc) return;
    if (chargeStatus === 'yes') return;

    const sale = salesMap[String(row.order_id)] || {};
    const product = String(sale.product || '');
    const qty = Number(sale.quantity) || 0;
    const slimPoly = String(sale.slim_poly || '');
    const productStr = product
      + (qty ? ` x ${qty}` : '')
      + (slimPoly && product === '5 Gallon' ? ` (${slimPoly})` : '');

    result.push({
      orderId: String(row.order_id),
      date: formatDate(row.date),
      customerName: String(row.customer_name || ''),
      amount: Number(row.amount) || 0,
      status: String(row.status || ''),
      product: productStr,
    });
  });

  return result;
}

export async function getChargedDebtsBreakdown(staffName) {
  const [pautangRes, salesRes] = await Promise.all([
    supabase.from('pautang').select('*'),
    supabase.from('sales').select('order_id,product,quantity,slim_poly'),
  ]);

  if (pautangRes.error) throw pautangRes.error;
  if (salesRes.error) throw salesRes.error;

  const salesMap = {};
  (salesRes.data || []).forEach((sr) => {
    if (!sr.order_id) return;
    salesMap[String(sr.order_id)] = sr;
  });

  const nameLc = staffName.toLowerCase();
  const result = [];

  (pautangRes.data || []).forEach((row) => {
    if (!row.order_id) return;
    const pointPerson = String(row.point_person || '');
    const chargeStatus = String(row.charge_status || 'No').toLowerCase();
    if (pointPerson.toLowerCase() !== nameLc) return;
    if (chargeStatus !== 'yes') return;

    const sale = salesMap[String(row.order_id)] || {};
    const product = String(sale.product || '');
    const qty = Number(sale.quantity) || 0;
    const slimPoly = String(sale.slim_poly || '');
    const productStr = product
      + (qty ? ` x ${qty}` : '')
      + (slimPoly && product === '5 Gallon' ? ` (${slimPoly})` : '');

    result.push({
      orderId: String(row.order_id),
      date: formatDate(row.date),
      customerName: String(row.customer_name || ''),
      product: productStr,
      status: String(row.status || ''),
      amount: Number(row.amount) || 0,
    });
  });

  return result;
}

export async function addStaff(staffData) {
  const { data, error } = await supabase.rpc('add_staff', { data: staffData });
  if (error) throw error;
  return data;
}

export async function updatePayroll(staffId, fields) {
  const { data, error } = await supabase.rpc('update_payroll', {
    p_staff_id: staffId,
    data: fields,
  });
  if (error) throw error;
  return data;
}

export async function deleteStaff(staffId) {
  const { data, error } = await supabase.rpc('delete_staff', { p_staff_id: staffId });
  if (error) throw error;
  return data;
}

export async function updateDaysWorked(staffId, delta) {
  const { data, error } = await supabase.rpc('update_days_worked', {
    p_staff_id: staffId,
    p_delta: delta,
  });
  if (error) throw error;
  return data;
}

export async function addAdvance(staffId, amount) {
  const { data, error } = await supabase.rpc('add_advance', {
    p_staff_id: staffId,
    p_amount: amount,
  });
  if (error) throw error;
  return data;
}

export async function releasePay(staffId) {
  const { data, error } = await supabase.rpc('release_pay', { p_staff_id: staffId });
  if (error) throw error;
  return data;
}

export async function clearPayrollRows(staffIds) {
  const ids = Array.isArray(staffIds) ? staffIds : [staffIds];
  const { data, error } = await supabase.rpc('clear_payroll_rows', { p_staff_ids: ids });
  if (error) throw error;
  return data;
}

export async function chargeDebtsForStaff(staffName) {
  const { data, error } = await supabase.rpc('charge_debts_for_staff', { p_staff_name: staffName });
  if (error) throw error;
  return data;
}

export { getShiftStatus, payPautang } from './pautang.js';

export default {
  getPayrollData,
  getConfigRoles,
  getPautangDebtsForStaff,
  getChargedDebtsBreakdown,
  addStaff,
  updatePayroll,
  deleteStaff,
  updateDaysWorked,
  addAdvance,
  releasePay,
  clearPayrollRows,
  chargeDebtsForStaff,
  calcExpected,
};
