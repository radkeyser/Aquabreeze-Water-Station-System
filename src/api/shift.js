import { supabase } from '../supabaseClient';
import { formatDate, formatTime } from '../utils/format';

export async function getActiveShift() {
  const { data, error } = await supabase
    .from('shift')
    .select('*')
    .eq('status', 'Open')
    .order('date', { ascending: false })
    .order('time', { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return {
    shiftId: row.shift_id,
    date: formatDate(row.date),
    time: row.time ? formatTime(row.time) : '',
    status: row.status,
  };
}

export async function getShiftStatus() {
  const shift = await getActiveShift();
  return { isOpen: !!shift, shift };
}

export async function startShift(startingCash) {
  const { data, error } = await supabase.rpc('start_shift', { p_starting_cash: startingCash });
  if (error) throw error;
  return data;
}

export async function endShift(actualCash) {
  const { data, error } = await supabase.rpc('end_shift', { p_actual_cash: actualCash });
  if (error) throw error;
  return data;
}

export async function getDayReportForShift(shiftId) {
  const { data, error } = await supabase.rpc('get_day_report_for_shift', { p_shift_id: shiftId });
  if (error) throw error;
  return data;
}

export async function checkShiftCloseRequirements() {
  const today = formatDate(new Date());

  const [{ data: invData, error: invErr }, { data: mrData, error: mrErr }] = await Promise.all([
    supabase.from('daily_inventory').select('record_id').eq('date', today).limit(1),
    supabase.from('meter_reading').select('record_id').eq('date', today).limit(1),
  ]);

  if (invErr) throw invErr;
  if (mrErr) throw mrErr;

  return {
    dailyCountDone: !!invData?.length,
    meterReadingDone: !!mrData?.length,
  };
}

export default { getActiveShift, getShiftStatus, startShift, endShift, getDayReportForShift, checkShiftCloseRequirements };