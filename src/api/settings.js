import { supabase } from '../supabaseClient';

function mapProduct(row) {
  return {
    id: row.product_id,
    name: row.name,
    price: Number(row.price) || 0,
    type: row.type || 'Product',
    commissionRate: Number(row.commission_rate) || 0,
    pickupPrice: Number(row.pickup_price) || 0,
  };
}

function mapSupplier(row) {
  return {
    id: row.supplier_id,
    name: row.supplier_name,
    qty500: Number(row.qty_500ml) || 0,
    price500: Number(row.price_500ml) || 0,
    qty1000: Number(row.qty_1000ml) || 0,
    price1000: Number(row.price_1000ml) || 0,
    qtyGallon: Number(row.qty_slim_gallon) || 0,
    priceGallon: Number(row.price_slim_gallon) || 0,
  };
}

export async function getProducts() {
  const { data, error } = await supabase
    .from('products')
    .select('product_id,name,price,type,commission_rate,pickup_price')
    .order('product_id', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapProduct);
}

export async function addProduct(payload) {
  const { data, error } = await supabase.rpc('add_product', { data: payload });
  if (error) throw error;
  return data;
}

export async function updateProduct(productId, payload) {
  const { data, error } = await supabase.rpc('update_product', {
    p_product_id: productId,
    data: payload,
  });
  if (error) throw error;
  return data;
}

export async function deleteProduct(productId) {
  const { data, error } = await supabase.rpc('delete_product', {
    p_product_id: productId,
  });
  if (error) throw error;
  return data;
}

export async function getSuppliers() {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('supplier_name', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapSupplier);
}

export async function addSupplier(payload) {
  const { data, error } = await supabase.rpc('add_supplier', { data: payload });
  if (error) throw error;
  return data;
}

export async function updateSupplier(supplierId, payload) {
  const { data, error } = await supabase.rpc('update_supplier', {
    p_supplier_id: supplierId,
    data: payload,
  });
  if (error) throw error;
  return data;
}

export async function deleteSupplier(supplierId) {
  const { data, error } = await supabase.rpc('delete_supplier', {
    p_supplier_id: supplierId,
  });
  if (error) throw error;
  return data;
}

export async function getConfigData() {
  const [rolesRes, expensesRes] = await Promise.all([
    supabase.from('roles').select('name').order('name', { ascending: true }),
    supabase.from('expense_suggestions').select('name').order('name', { ascending: true }),
  ]);

  if (rolesRes.error) throw rolesRes.error;
  if (expensesRes.error) throw expensesRes.error;

  return {
    roles: (rolesRes.data || []).map((r) => r.name),
    expenses: (expensesRes.data || []).map((e) => e.name),
  };
}

export async function saveConfigData(payload) {
  const { data, error } = await supabase.rpc('save_config_data', { payload });
  if (error) throw error;
  return data;
}

export default {
  getProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  getSuppliers,
  addSupplier,
  updateSupplier,
  deleteSupplier,
  getConfigData,
  saveConfigData,
};
