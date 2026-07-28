import { supabase } from '../supabaseClient.js';
import { formatDate, formatTime } from '../utils/format.js';

async function nextCashDrawerId() {
  const { data, error } = await supabase.rpc('next_id', { p_prefix: 'CD' });
  if (error) throw error;
  return String(data || '');
}

function normalizeStartingCash(row) {
  if (!row) return 0;
  return (
    Number(row.starting_cash || row.startingCash || row.startcash || row.startingcash || 0) || 0
  );
}

function calculateExpectedCash(startingCash, transactions = []) {
  const totals = (transactions || []).reduce(
    (acc, item) => {
      if (String(item.type || '').toLowerCase() === 'in') {
        acc.in += Number(item.amount) || 0;
      }
      if (String(item.type || '').toLowerCase() === 'out') {
        acc.out += Number(item.amount) || 0;
      }
      return acc;
    },
    { in: 0, out: 0 }
  );
  return startingCash + totals.in - totals.out;
}

export async function getActiveShift() {
  const { data, error } = await supabase
    .from('shift')
    .select('shift_id,status,date,time')
    .eq('status', 'Open')
    .order('date', { ascending: false })
    .order('time', { ascending: false })
    .limit(1);

  if (error) throw error;
  return (data || [])[0] || null;
}

export async function getConfigExpenses() {
  const { data, error } = await supabase
    .from('expense_suggestions')
    .select('name')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => String(row.name || '')).filter(Boolean);
}

export async function getCashDrawerData() {
  const activeShift = await getActiveShift();
  const shiftId = activeShift?.shift_id || '';

  const [cashRes, dayReportRes] = await Promise.all([
    supabase
      .from('cash_drawer')
      .select('*')
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .eq('shift_id', shiftId),
    shiftId
      ? supabase.from('day_report').select('*').eq('shift_id', shiftId).limit(1)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (cashRes.error) throw cashRes.error;
  if (dayReportRes.error) throw dayReportRes.error;

  const rows = cashRes.data || [];
  const startingCash = normalizeStartingCash((dayReportRes.data || [])[0]);
  const expectedCash = calculateExpectedCash(startingCash, rows);

  return {
    transactions: rows,
    startingCash,
    expectedCash,
    activeShiftId: shiftId,
    hasShift: !!shiftId,
  };
}

export async function addCashIn(payload) {
  const shift = await getActiveShift();
  const shiftId = shift?.shift_id || '';
  const rawAmount = Number(payload.amount) || 0;
  const description = String(payload.description || 'Cash Added').trim();
  const generatedId = await nextCashDrawerId();

  const entry = {
    id: generatedId,
    date: formatDate(new Date()),
    time: formatTime(new Date()),
    type: 'in',
    description,
    amount: rawAmount,
    point_person: String(payload.pointPerson || ''),
    shift_id: shiftId,
  };

  if (entry.point_person === '') {
    delete entry.point_person;
  }

  if (entry.shift_id === '') {
    delete entry.shift_id;
  }

  const { data, error } = await supabase.from('cash_drawer').insert([entry]);

  if (error) throw error;
  return data;
}

export async function addCashExpense(payload) {
  const shift = await getActiveShift();
  const shiftId = shift?.shift_id || '';
  const rawAmount = Number(payload.amount) || 0;
  const description = String(payload.description || 'Expense').trim();
  const generatedId = await nextCashDrawerId();

  const entry = {
    id: generatedId,
    date: formatDate(new Date()),
    time: formatTime(new Date()),
    type: 'out',
    description,
    amount: rawAmount,
    point_person: String(payload.pointPerson || ''),
    shift_id: shiftId,
  };

  if (entry.point_person === '') {
    delete entry.point_person;
  }

  if (entry.shift_id === '') {
    delete entry.shift_id;
  }

  const { data, error } = await supabase.from('cash_drawer').insert([entry]);

  if (error) throw error;
  return data;
}

export async function deleteCashEntry(entryId) {
  const { data, error } = await supabase.from('cash_drawer').delete().eq('id', entryId);
  if (error) throw error;
  return data;
}

export default {
  getActiveShift,
  getConfigExpenses,
  getCashDrawerData,
  addCashIn,
  addCashExpense,
  deleteCashEntry,
};