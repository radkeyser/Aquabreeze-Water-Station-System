import { supabase } from '../supabaseClient';
import { formatDate, formatTime } from '../utils/format';

function mapAccount(r) {
  return {
    id: r.account_id, name: r.name, type: r.type, balance: Number(r.balance) || 0,
    accountNumber: r.account_number || '', accountName: r.account_name || '',
  };
}
function mapTx(r) {
  return {
    id: r.tx_id, date: r.date, time: r.time ? formatTime(r.time) : '', type: r.type,
    from: r.from_account || '', to: r.to_account || '', amount: Number(r.amount) || 0,
    reference: r.reference_number || '', description: r.description || '',
    shiftId: r.shift_id || '', status: r.status || 'Verified',
  };
}

export async function getCashManagementData() {
  const [{ data: accData, error: accErr }, { data: txData, error: txErr }] = await Promise.all([
    supabase.from('cash_accounts').select('*'),
    supabase.from('cash_transactions').select('*').order('date', { ascending: false }).order('time', { ascending: false }),
  ]);
  if (accErr) throw accErr;
  if (txErr) throw txErr;

  const accounts = (accData || []).map(mapAccount);
  const transactions = (txData || []).map(mapTx);
  const cashAcc = accounts.find((a) => a.name === 'Cash') || { balance: 0 };
  const bankAccs = accounts.filter((a) => a.type === 'Bank');
  const pettyAccs = accounts.filter((a) => a.type === 'PettyCash');
  const unverified = transactions.filter((t) => t.status === 'Unverified').reduce((s, t) => s + t.amount, 0);

  return {
    accounts,
    transactions,
    summary: {
      cashOnHand: cashAcc.balance,
      cashInBank: bankAccs.reduce((s, a) => s + a.balance, 0),
      pettyCash: pettyAccs.reduce((s, a) => s + a.balance, 0),
      unverifiedCash: unverified,
    },
  };
}

export async function addBankAccount({ name, accountNumber, accountName }) {
  const { data: existing } = await supabase.from('cash_accounts').select('name').ilike('name', name);
  if (existing?.length) return { success: false, message: `An account named "${name}" already exists.` };
  const { data: id, error: idErr } = await supabase.rpc('next_id', { p_prefix: 'ACC' });
  if (idErr) throw idErr;
  const { error } = await supabase.from('cash_accounts').insert({
    account_id: id, name, type: 'Bank', balance: 0,
    account_number: accountNumber || '', account_name: accountName || '', created_at: formatDate(new Date()),
  });
  if (error) throw error;
  return { success: true, message: `${name} added!` };
}

export async function deleteBankAccount(name) {
  const { error, count } = await supabase.from('cash_accounts').delete({ count: 'exact' }).eq('name', name).eq('type', 'Bank');
  if (error) throw error;
  return count ? { success: true, message: 'Account deleted.' } : { success: false, message: 'Account not found.' };
}

export async function addPettyCashAccount({ name }) {
  const { data: existing } = await supabase.from('cash_accounts').select('name').ilike('name', name);
  if (existing?.length) return { success: false, message: `Account "${name}" already exists.` };
  const { data: id, error: idErr } = await supabase.rpc('next_id', { p_prefix: 'ACC' });
  if (idErr) throw idErr;
  const { error } = await supabase.from('cash_accounts').insert({
    account_id: id, name, type: 'PettyCash', balance: 0, created_at: formatDate(new Date()),
  });
  if (error) throw error;
  return { success: true, message: `${name} added!` };
}

export async function deletePettyCashAccount(name) {
  if (name === 'Petty Cash') return { success: false, message: 'Cannot delete the default Petty Cash account.' };
  const { error, count } = await supabase.from('cash_accounts').delete({ count: 'exact' }).eq('name', name).eq('type', 'PettyCash');
  if (error) throw error;
  return count ? { success: true, message: 'Account deleted.' } : { success: false, message: 'Account not found.' };
}

export async function cashTransfer({ from, to, amount, description }) {
  const { data, error } = await supabase.rpc('cash_transfer', { p_from: from, p_to: to, p_amount: amount, p_description: description || '' });
  if (error) throw error;
  return data;
}
export async function cashDeposit({ bankAccount, amount, accountNumber, accountName, reference, description }) {
  const { data, error } = await supabase.rpc('cash_deposit', {
    p_bank_account: bankAccount, p_amount: amount, p_reference: reference || '', p_description: description || '',
    p_account_number: accountNumber || '', p_account_name: accountName || '',
  });
  if (error) throw error;
  return data;
}
export async function bankWithdraw({ bankAccount, amount, reference, description }) {
  const { data, error } = await supabase.rpc('bank_withdraw', { p_bank_account: bankAccount, p_amount: amount, p_reference: reference || '', p_description: description || '' });
  if (error) throw error;
  return data;
}
export async function bankPayment({ bankAccount, category, amount, transferFee, reference, description, destBank, destAccNum, destAccName }) {
  const { data, error } = await supabase.rpc('bank_payment', {
    p_bank_account: bankAccount, p_category: category, p_amount: amount, p_transfer_fee: transferFee || 0,
    p_reference: reference || '', p_description: description || '',
    p_dest_bank: destBank || '', p_dest_acc_num: destAccNum || '', p_dest_acc_name: destAccName || '',
  });
  if (error) throw error;
  return data;
}
export async function bankAddFunds({ bankAccount, source, amount, reference, description }) {
  const { data, error } = await supabase.rpc('bank_add_funds', { p_bank_account: bankAccount, p_source: source, p_amount: amount, p_reference: reference || '', p_description: description || '' });
  if (error) throw error;
  return data;
}
export async function pettyCashOut({ fromAccount, amount, description }) {
  const { data, error } = await supabase.rpc('petty_cash_out', { p_from_account: fromAccount, p_amount: amount, p_description: description || '' });
  if (error) throw error;
  return data;
}

export async function getShiftVerificationData() {
  const [{ data: shiftData, error: shiftErr }, { data: reportData, error: repErr }] = await Promise.all([
    supabase.from('shift').select('*').eq('status', 'Close').order('date', { ascending: false }),
    supabase.from('day_report').select('*'),
  ]);
  if (shiftErr) throw shiftErr;
  if (repErr) throw repErr;

  const reportMap = {};
  (reportData || []).forEach((r) => { reportMap[r.shift_id] = r; });

  const shifts = (shiftData || []).map((s) => {
    const rep = reportMap[s.shift_id] || {};
    return {
      shiftId: s.shift_id, date: s.date, time: s.time ? formatTime(s.time) : '',
      expectedCash: Number(rep.expected_cash_amount) || 0,
      declaredCount: Number(rep.actual_cash_amount) || 0,
      verifiedCount: Number(rep.verified_count) || 0,
      variance: (Number(rep.verified_count) || 0) - (Number(rep.actual_cash_amount) || 0),
      remarks: rep.remarks || '', verified: !!rep.verified,
    };
  });

  shifts.sort((a, b) => new Date(b.date) - new Date(a.date));
  return { shifts };
}

export async function verifyShiftCash({ shiftId, verifiedCount, remarks }) {
  const { data, error } = await supabase.rpc('verify_shift_cash', { p_shift_id: shiftId, p_verified_count: verifiedCount, p_remarks: remarks || '' });
  if (error) throw error;
  return data;
}

function nextMonthStr(month) {
  const [y, m] = month.split('-').map(Number);
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return `${nextY}-${String(nextM).padStart(2, '0')}`;
}

export async function getBankReconciliationData(month, selectedBank) {
  const [{ data: txData, error: txErr }, { data: reconData, error: reconErr }, { data: accData, error: accErr }] = await Promise.all([
    supabase.from('cash_transactions').select('*').gte('date', `${month}-01`).lt('date', `${nextMonthStr(month)}-01`),
    supabase.from('bank_reconciliation').select('*').eq('month', month).eq('selected_bank', selectedBank || ''),
    supabase.from('cash_accounts').select('*'),
  ]);
  if (txErr) throw txErr;
  if (reconErr) throw reconErr;
  if (accErr) throw accErr;

  const bankTx = (txData || [])
    .filter((r) => ['Deposit', 'Withdraw', 'Payment', 'Add'].includes(r.type))
    .filter((r) => !selectedBank || r.from_account === selectedBank || r.to_account === selectedBank)
    .map((r) => ({
      id: r.tx_id, date: r.date, time: r.time ? formatTime(r.time) : '', type: r.type,
      description: r.description || '', bank: r.from_account || r.to_account, amount: Number(r.amount) || 0,
    }));

  const row = reconData?.[0];
  const existing = row ? {
    interestIncome: Number(row.interest_income) || 0, unrecordedDeposit: Number(row.unrecorded_deposit) || 0,
    correction: Number(row.correction) || 0, bookNotes: row.book_notes || '',
    bankEndingBalance: Number(row.bank_ending_balance) || 0, depositInTransit: Number(row.deposit_in_transit) || 0,
    bankNotes: row.bank_notes || '', bookTotal: Number(row.book_total) || 0, bankTotal: Number(row.bank_total) || 0,
    isBalanced: !!row.is_balanced, selectedBank: row.selected_bank || '',
  } : null;

  const accounts = (accData || []).map(mapAccount);
  const bankAccs = accounts.filter((a) => a.type === 'Bank');
  const bookEnding = bankAccs.reduce((s, a) => s + a.balance, 0);

  return { month, bankTx, bookEnding, accounts, existing, selectedBank: selectedBank || '' };
}

export async function saveBankReconciliation(payload) {
  const { data, error } = await supabase.rpc('save_bank_reconciliation', { payload });
  if (error) throw error;
  return data;
}

export async function getPaymentCategories() {
  const { data, error } = await supabase.from('payment_categories').select('name').order('name');
  if (error) throw error;
  return (data || []).map((r) => r.name);
}
export async function addPaymentCategory(name) {
  await supabase.from('payment_categories').insert({ name }); // ignore duplicate-key error
  return { success: true };
}

export default {
  getCashManagementData, addBankAccount, deleteBankAccount, addPettyCashAccount, deletePettyCashAccount,
  cashTransfer, cashDeposit, bankWithdraw, bankPayment, bankAddFunds, pettyCashOut,
  getShiftVerificationData, verifyShiftCash, getBankReconciliationData, saveBankReconciliation,
  getPaymentCategories, addPaymentCategory,
};