import { supabase } from '../supabaseClient';

const CART_STORAGE_KEY = 'pos_cart_state';
const QUEUE_KEY = 'pos_sale_queue';

// ── Mappers ──────────────────────────────────────────────────────────

function mapProduct(row) {
  return {
    id: row.product_id,
    name: row.name,
    price: Number(row.price || 0),
    type: row.type || 'Product',
    commissionRate: Number(row.commission_rate || 0),
    pickupPrice: Number(row.pickup_price || 0) > 0
      ? Number(row.pickup_price)
      : Number(row.price || 0),
  };
}

function mapCustomer(row) {
  return {
    id: row.customer_id,
    name: row.name,
    location: row.location || '',
    pointPerson: row.point_person || '',
    override: row.override ? 'yes' : 'no',
    overridePrice5Gal: Number(row.override_5gal || 0),
    overridePrice500: Number(row.override_500ml || 0),
    overridePrice1000: Number(row.override_1000ml || 0),
  };
}

function mapStaff(row) {
  return {
    id: row.staff_id,
    name: row.name,
    role: row.role || '',
  };
}

// ── Initial data load (replaces getPOSInitData) ──────────────────────

export async function getPosInitData() {
  const [productsRes, customersRes, staffRes] = await Promise.all([
    supabase
      .from('products')
      .select('product_id,name,price,type,commission_rate,pickup_price')
      .order('product_id', { ascending: true }),
    supabase
      .from('customers')
      .select('customer_id,name,location,point_person,override,override_5gal,override_500ml,override_1000ml')
      .order('name', { ascending: true }),
    supabase
      .from('staff')
      .select('staff_id,name,role')
      .order('name', { ascending: true }),
  ]);

  if (productsRes.error) throw productsRes.error;
  if (customersRes.error) throw customersRes.error;
  if (staffRes.error) throw staffRes.error;

  const products = (productsRes.data || []).map(mapProduct);
  const customers = (customersRes.data || []).map(mapCustomer);
  const staff = (staffRes.data || []).map(mapStaff);

  return { products, customers, staff };
}

// ── Checkout (replaces completeSaleBatch) ────────────────────────────

export async function completeSaleBatch(batchPayload) {
  const { data, error } = await supabase.rpc('complete_sale_batch', {
    batch: batchPayload,
  });

  if (error) throw error;

  const results = Array.isArray(data) ? data : [];
  const hasError = results.some((r) => r && r.success === false);
  if (hasError) {
    const msg = results.find((r) => r && r.message)?.message || 'Some items failed to save.';
    throw new Error(msg);
  }

  return results;
}

// ── Build checkout payload from cart (matches App Script shape) ──────

export function buildCheckoutPayload(cart, clientRequestId) {
  const regularItems = cart.filter((i) => !i.isBorrow);
  const borrowItems = cart.filter((i) => i.isBorrow);

  const customerGroups = {};
  regularItems.forEach((item) => {
    if (!customerGroups[item.customer]) {
      customerGroups[item.customer] = {
        customer: item.customer,
        location: item.location || '',
        pointPerson: item.pointPerson || '',
        isNewCustomer: item.isNewCustomer || false,
        cart: [],
      };
    }
    customerGroups[item.customer].cart.push({
      id: item.productId,
      name: item.productName,
      price: item.price,
      qty: item.qty,
      amountPaid: item.amountPaid || 0,
      status: item.status,
      slimPoly: item.slimPoly || '',
      commissionRate: item.commissionRate || 0,
      tip: item.tip || 0,
      notes: item.notes || '',
      paymentMethod: item.paymentMethod || 'Cash',
      borrowedGallon: item.borrowedGallon || false,
    });
  });

  const borrowPayloads = borrowItems.map((item) => ({
    customer: item.customer,
    location: item.location || '',
    pointPerson: item.pointPerson || '',
    gallon: item.gallon || 0,
    dispenser: item.dispenser || 0,
  }));

  return {
    payloads: Object.values(customerGroups),
    borrowPayloads,
    clientRequestId,
  };
}

// ── Customer override price helper ───────────────────────────────────

const OVERRIDE_MAP = {
  'PROD-000001': 'overridePrice5Gal',
  'PROD-000004': 'overridePrice500',
  'PROD-000002': 'overridePrice1000',
};

export function getOverridePrice(customer, product) {
  if (!customer || !product) return null;
  if (String(customer.override || '').toLowerCase() !== 'yes') return null;
  const key = OVERRIDE_MAP[String(product.id)];
  if (!key) return null;
  const amt = Number(customer[key] || 0);
  return amt > 0 ? amt : null;
}

// ── Cart localStorage persistence ────────────────────────────────────

export function loadCartFromStorage() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCartToStorage(cart) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // ignore quota errors
  }
}

// ── Offline sale queue ───────────────────────────────────────────────

export function getSaleQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveSaleQueue(queue) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // ignore
  }
}

export function enqueueSale(payload) {
  const q = getSaleQueue();
  q.push({ payload, timestamp: Date.now() });
  saveSaleQueue(q);
}

export async function flushSaleQueue() {
  const q = getSaleQueue();
  if (!q.length) return { flushed: 0, remaining: 0 };

  const batch = q[0];
  saveSaleQueue(q.slice(1));

  try {
    await completeSaleBatch(batch.payload);
    const next = await flushSaleQueue();
    return { flushed: 1 + next.flushed, remaining: next.remaining };
  } catch (err) {
    const qNow = getSaleQueue();
    qNow.unshift(batch);
    saveSaleQueue(qNow);

    if (err?.code === 'PGRST202' || err?.code === '42725' || err?.status === 400) {
      return { flushed: 0, remaining: qNow.length, error: err };
    }

    throw err;
  }
}

export function generateClientRequestId() {
  return `REQ-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default {
  getPosInitData,
  completeSaleBatch,
  buildCheckoutPayload,
  getOverridePrice,
  loadCartFromStorage,
  saveCartToStorage,
  getSaleQueue,
  enqueueSale,
  flushSaleQueue,
  generateClientRequestId,
};
