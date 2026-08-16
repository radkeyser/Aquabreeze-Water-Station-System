import { supabase } from '../supabaseClient';
import { formatDate, formatTime } from '../utils/format';

export function calcExpected(rate, days, advance, commission, debtCharge, sss = 0, pagibig = 0, philhealth = 0) {
  return (Number(rate) || 0) * (Number(days) || 0)
    - (Number(advance) || 0)
    + (Number(commission) || 0)
    - (Number(debtCharge) || 0)
    - (Number(sss) || 0)
    - (Number(pagibig) || 0)
    - (Number(philhealth) || 0);
}

async function getStaffCommission(name) {
  const { data, error } = await supabase.rpc('get_staff_commission', { p_name: name });
  if (error) throw error;
  return Number(data) || 0;
}

function mapPayrollRow(row, commission, staffInfo = {}) {
  const daysWorked = Number(row.days_worked) || 0;
  const dailyRate = Number(row.daily_rate) || 0;
  const advance = Number(row.advance) || 0;
  const debtCharge = Number(row.debt_charge) || 0;
  const sss = Number(row.sss) || 0;
  const pagibig = Number(row.pagibig) || 0;
  const philhealth = Number(row.philhealth) || 0;
  const expectedSalary = calcExpected(dailyRate, daysWorked, advance, commission, debtCharge, sss, pagibig, philhealth);

  return {
    id: row.staff_id,
    name: String(row.name || ''),
    role: String(row.role || ''),
    daysWorked,
    dailyRate,
    advance,
    commission,
    debtCharge,
    sss,
    pagibig,
    philhealth,
    expectedSalary,
    status: String(row.status || 'Pending'),
    dateReleased: row.date_released ? formatDate(row.date_released) : '',
    timeReleased: row.time_released ? formatTime(row.time_released) : '',
    type: staffInfo.type || 'Salary-Based',
    commission5Gal: Number(staffInfo.commission_5gal) || 0,
    commission1000mL: Number(staffInfo.commission_1000ml) || 0,
    commission500mL: Number(staffInfo.commission_500ml) || 0,
    commissionSlim: Number(staffInfo.commission_slim) || 0,
  };
}

export async function getPayrollData() {
  const [{ data, error }, staffRes] = await Promise.all([
    supabase.from('payroll').select('*').order('name', { ascending: true }),
    supabase.from('staff').select('*'),
  ]);

  if (error) throw error;
  if (staffRes.error) throw staffRes.error;

  const staffMap = {};
  (staffRes.data || []).forEach((s) => {
    staffMap[String(s.name || '').trim().toLowerCase()] = s;
  });

  const rows = data || [];
  const employees = await Promise.all(
    rows.map(async (row) => {
      const commission = await getStaffCommission(row.name);
      const staffInfo = staffMap[String(row.name || '').trim().toLowerCase()] || {};
      return mapPayrollRow(row, commission, staffInfo);
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

export async function setHoursWorked(staffId, hours) {
  const { data, error } = await supabase.rpc('set_hours_worked', {
    p_staff_id: staffId,
    p_hours: hours,
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

export async function getCommissionsDetail() {
  const [commRes, staffRes] = await Promise.all([
    supabase.from('commissions').select('*').order('date', { ascending: false }),
    supabase.from('staff').select('*'),
  ]);

  if (commRes.error) throw commRes.error;
  if (staffRes.error) throw staffRes.error;

  const staffMap = {};
  (staffRes.data || []).forEach((s) => {
    staffMap[String(s.name || '').trim().toLowerCase()] = s;
  });

  const groups = {};
  (commRes.data || []).forEach((row) => {
    const name = String(row.point_person || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (!groups[key]) {
      const info = staffMap[key] || {};
      groups[key] = {
        name,
        role: info.role || '',
        type: info.type || 'Salary-Based',
        commission5Gal: Number(info.commission_5gal) || 0,
        commission1000mL: Number(info.commission_1000ml) || 0,
        commission500mL: Number(info.commission_500ml) || 0,
        commissionSlim: Number(info.commission_slim) || 0,
        entries: [],
        payableTotal: 0,
        lockedTotal: 0,
      };
    }
    const amount = Number(row.total_commission) || 0;
    const delivered = row.delivered === 'Delivered';
    groups[key].entries.push({
      orderId: row.order_id,
      date: formatDate(row.date),
      customerName: row.customer_name || '',
      location: row.location || '',
      product: row.product || '',
      quantity: Number(row.quantity) || 0,
      amount,
      delivered: row.delivered || 'Undelivered',
    });
    if (delivered) groups[key].payableTotal += amount;
    else groups[key].lockedTotal += amount;
  });

  const result = Object.values(groups).map((g) => ({
    ...g,
    entries: g.entries.sort((a, b) => new Date(b.date) - new Date(a.date)),
  }));

  result.sort((a, b) => a.name.localeCompare(b.name));
  return result;
}

export async function getPayrollHistory() {
  const { data, error } = await supabase
    .from('payroll_history')
    .select('*')
    .order('date_released', { ascending: false })
    .order('time_released', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    staffId: row.staff_id,
    staffName: row.staff_name,
    role: row.role || '',
    daysWorked: Number(row.days_worked) || 0,
    dailyRate: Number(row.daily_rate) || 0,
    advance: Number(row.advance) || 0,
    commission: Number(row.commission) || 0,
    debtCharge: Number(row.debt_charge) || 0,
    sss: Number(row.sss) || 0,
    pagibig: Number(row.pagibig) || 0,
    philhealth: Number(row.philhealth) || 0,
    expectedSalary: Number(row.expected_salary) || 0,
    releasedPautang: Array.isArray(row.released_pautang) ? row.released_pautang : [],
    releasedCommissions: Array.isArray(row.released_commissions) ? row.released_commissions : [],
    dateReleased: row.date_released ? formatDate(row.date_released) : '',
    timeReleased: row.time_released ? formatTime(row.time_released) : '',
  }));
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
  setHoursWorked,
  getPayrollHistory,
  getCommissionsDetail,
};
