import { supabase } from '../supabaseClient';

export async function getReportsData() {
  // Fetch core datasets in parallel
  const [s1, s2, s3, s4] = await Promise.all([
    supabase.from('sales').select('*'),
    supabase.from('cash_drawer').select('*'),
    supabase.from('pautang').select('*'),
    supabase.from('customers').select('*'),
  ]);

  // Map results (ignore errors for now, return empty arrays)
  const sales = s1.error ? [] : s1.data || [];
  const cashDrawer = s2.error ? [] : s2.data || [];
  const pautang = s3.error ? [] : s3.data || [];
  const customers = s4.error ? [] : s4.data || [];

  // Derive collections and advances from cash_drawer heuristics
  const collections = cashDrawer.filter((r) => r.type === 'in');
  const advances = cashDrawer.filter((r) => /advance/i.test(r.description || ''));
  const expenses = cashDrawer.filter((r) => r.type === 'out' && !/advance/i.test(r.description || ''));

  // Fetch shifts and day_report too
  const [s5, s6] = await Promise.all([
    supabase.from('shift').select('*'),
    supabase.from('day_report').select('*'),
  ]);
  const shifts = s5.error ? [] : s5.data || [];
  const dayReport = s6.error ? [] : s6.data || [];

  return {
    sales,
    cashDrawer,
    pautang,
    customers,
    collections,
    advances,
    expenses,
    shifts,
    dayReport,
  };
}

export default getReportsData;
