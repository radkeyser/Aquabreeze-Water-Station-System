import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { showToast as notify } from '../../../src/utils/toast.js';
import './pos.css';
<<<<<<< HEAD
import '../../../src/index.css';
=======
>>>>>>> 1ab3d3f76c3a8e0e1f43eccc85b0ae7f68d97422
import {
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
} from '../../../src/api/pos.js';

const QUEUE_PAUSE_KEY = 'pos_queue_flush_paused';

function loadQueueFlushPaused() {
  try {
    return localStorage.getItem(QUEUE_PAUSE_KEY) === '1';
  } catch {
    return false;
  }
}

function saveQueueFlushPaused(paused) {
  try {
    localStorage.setItem(QUEUE_PAUSE_KEY, paused ? '1' : '0');
  } catch {
    // ignore
  }
}

function formatPeso(amount) {
  return '₱' + Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildBorrowLabel(gallon, dispenser) {
  const parts = [];
  if (gallon > 0) parts.push(`Gallon x${gallon}`);
  if (dispenser > 0) parts.push(`Dispenser x${dispenser}`);
  return parts.length ? parts.join(', ') : 'Borrow';
}

const PICKUP_CUSTOMER = { id: 'CUST-PICKUP', name: 'Pickup Customer', location: '', pointPerson: '', isPickup: true };

export default function POSPage() {
  const [cart, setCart] = useState(() => loadCartFromStorage());
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedBorrow, setSelectedBorrow] = useState(null);
  const [panelType, setPanelType] = useState(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [chosenCustomer, setChosenCustomer] = useState(null);
  const [newCustomerMode, setNewCustomerMode] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerLocation, setNewCustomerLocation] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [customPrice, setCustomPrice] = useState(null);
  const [priceEditOpen, setPriceEditOpen] = useState(false);
  const [overrideActive, setOverrideActive] = useState(false);
  const [slimPoly, setSlimPoly] = useState('');
  const [amountPaid, setAmountPaid] = useState(0);
  const [tip, setTip] = useState(0);
  const [notes, setNotes] = useState('');
  const [pointPerson, setPointPerson] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [editCartIndex, setEditCartIndex] = useState(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [queueCount, setQueueCount] = useState(() => getSaleQueue().length);
  const [queueFlushPaused, setQueueFlushPaused] = useState(() => loadQueueFlushPaused());
  const [products, setProducts] = useState([]);
  const [borrowItems, setBorrowItems] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loadingInit, setLoadingInit] = useState(true);
  const [initError, setInitError] = useState('');
  const clientRequestIdRef = useRef(null);

  useEffect(() => {
    saveCartToStorage(cart);
  }, [cart]);

  const showToast = useCallback((message, options) => notify(message, options), []);

  const loadInitial = useCallback(async () => {
    setInitError('');
    setLoadingInit(true);
    try {
      const { products: prods, customers: custs, staff } = await getPosInitData();
      setProducts(prods);
      setBorrowItems(prods.filter((p) => String(p.type).toLowerCase() === 'borrow'));
      setCustomers([PICKUP_CUSTOMER, ...custs]);
      setStaffList(staff);
    } catch (err) {
      console.error('POS init error', err);
      setInitError('Failed to load POS data: ' + (err?.message || String(err)));
      showToast('Failed to load POS data');
    } finally {
      setLoadingInit(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadInitial();
    if (queueFlushPaused) return;

    const timer = window.setTimeout(async () => {
      const result = await flushSaleQueue();
      setQueueCount(getSaleQueue().length);
      if (result?.error) {
        if (result.error?.code === 'PGRST202') {
          console.warn('POS checkout RPC is not deployed. Run supabase/migrations/001_complete_sale_batch.sql in the Supabase SQL Editor.');
          return;
        }
        if (result.error?.code === '42725') {
          console.warn('POS queue flush paused: next_id(text) is not unique on the backend.');
          setQueueFlushPaused(true);
          saveQueueFlushPaused(true);
          return;
        }
        console.error('flushSaleQueue failed:', result.error);
      }
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [loadInitial, queueFlushPaused]);

  const filteredCustomers = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    return customers.filter((c) => {
      if (c.isPickup) return false;
      if (!query) return true;
      return String(c.name || '').toLowerCase().includes(query) || String(c.location || '').toLowerCase().includes(query);
    });
  }, [customerQuery, customers]);

  const activePrice = useMemo(() => {
    if (!selectedProduct) return 0;
    if (customPrice !== null && customPrice !== undefined) return customPrice;
    return selectedProduct.price;
  }, [selectedProduct, customPrice]);

  const panelTotal = useMemo(() => activePrice * Math.max(0, quantity), [activePrice, quantity]);
  const isPickup = chosenCustomer?.isPickup;

  const effectiveAmountPaid = useMemo(() => {
    if (isPickup) return panelTotal;
    const paid = parseFloat(amountPaid);
    return Number.isFinite(paid) ? Math.min(Math.max(paid, 0), panelTotal) : 0;
  }, [amountPaid, panelTotal, isPickup]);

  const panelStatus = useMemo(() => {
    if (isPickup || (effectiveAmountPaid >= panelTotal && panelTotal > 0)) return 'Paid';
    if (effectiveAmountPaid <= 0) return 'Utang';
    if (effectiveAmountPaid < panelTotal) return 'Partial';
    return 'Paid';
  }, [effectiveAmountPaid, panelTotal, isPickup]);

  const orderSummary = useMemo(() => {
    if (!cart.length) return { rows: [], productNames: [], grandTotal: 0, totalPaid: 0, totalUtang: 0 };

    const productNames = [];
    const customerMap = {};

    cart.forEach((item) => {
      const displayName = item.productName + (item.slimPoly ? ` (${item.slimPoly})` : '');
      if (!productNames.includes(displayName)) productNames.push(displayName);

      if (!customerMap[item.customer]) {
        customerMap[item.customer] = { customer: item.customer, status: item.status, products: {} };
      }
      customerMap[item.customer].products[displayName] = (customerMap[item.customer].products[displayName] || 0) + item.qty;

      const existing = customerMap[item.customer].status;
      if (item.isBorrow) {
        customerMap[item.customer].status = customerMap[item.customer].status || 'Borrowed';
      } else if (item.status === 'Utang') {
        customerMap[item.customer].status = 'Utang';
      } else if (item.status === 'Partial' && existing !== 'Utang') {
        customerMap[item.customer].status = 'Partial';
      }
    });

    const grandTotal = cart.reduce((s, i) => s + (!i.isBorrow ? i.total : 0), 0);
    const totalPaid = cart.reduce((s, i) => s + (!i.isBorrow ? (i.amountPaid || 0) : 0), 0);
    const totalUtang = cart.reduce((s, i) => s + (!i.isBorrow ? Math.max(0, i.total - (i.amountPaid || 0)) : 0), 0);

    return { rows: Object.values(customerMap), productNames, grandTotal, totalPaid, totalUtang };
  }, [cart]);

  const cartCount = useMemo(() => cart.reduce((sum, item) => sum + (item.qty || 0), 0), [cart]);
  const cartGrandTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.total || 0), 0), [cart]);

  function applyCustomerPricing(customer, product) {
    if (!product) return;
    if (customer?.isPickup) {
      const pickupP = product.pickupPrice > 0 ? product.pickupPrice : product.price;
      setCustomPrice(pickupP);
      setOverrideActive(false);
      setAmountPaid(pickupP * Math.max(1, quantity));
      return;
    }
    const overrideAmt = getOverridePrice(customer, product);
    if (overrideAmt !== null) {
      setCustomPrice(overrideAmt);
      setOverrideActive(overrideAmt !== product.price);
    } else {
      setCustomPrice(null);
      setOverrideActive(false);
    }
    if (customer?.pointPerson) setPointPerson(customer.pointPerson);
  }

  function selectCustomer(customer) {
    setChosenCustomer(customer);
    setCustomerQuery(customer.name);
    setCustomerDropdownOpen(false);
    setNewCustomerMode(false);
    if (selectedProduct) applyCustomerPricing(customer, selectedProduct);
  }

  function resetPanelFields() {
    setCustomerQuery('');
    setCustomerDropdownOpen(false);
    setChosenCustomer(null);
    setNewCustomerMode(false);
    setNewCustomerName('');
    setNewCustomerLocation('');
    setQuantity(0);
    setCustomPrice(null);
    setPriceEditOpen(false);
    setOverrideActive(false);
    setSlimPoly('');
    setAmountPaid(0);
    setTip(0);
    setNotes('');
    setPointPerson('');
  }

  function openProductPanel(product) {
    setSelectedProduct(product);
    setSelectedBorrow(null);
    setPanelType('product');
    resetPanelFields();
  }

  function openBorrowPanel(product) {
    setSelectedBorrow(product);
    setSelectedProduct(null);
    setPanelType('borrow');
    resetPanelFields();
  }

  function closePanel() {
    setSelectedProduct(null);
    setSelectedBorrow(null);
    setPanelType(null);
    setCustomerDropdownOpen(false);
  }

  function addProductToCart() {
    if (!selectedProduct) return;

    let customerName = '';
    let location = '';
    let isNewCustomer = false;

    if (newCustomerMode) {
      customerName = newCustomerName.trim();
      location = newCustomerLocation.trim();
      if (!customerName) {
        showToast('Please enter a customer name.', { icon: 'error', highlightSelector: '#pdpCustomerSearch' });
        return;
      }
      isNewCustomer = true;
    } else if (chosenCustomer?.name) {
      customerName = chosenCustomer.name;
      location = chosenCustomer.location || '';
    } else {
      showToast('Please select a customer.', { icon: 'error', highlightSelector: '#pdpCustomerSearch' });
      return;
    }

    if (quantity < 1) {
      showToast('Please set a quantity.', { icon: 'error', highlightSelector: '#pdpQty' });
      return;
    }

    const qty = Math.max(1, quantity);
    if (selectedProduct.name === '5 Gallon' && !slimPoly) {
      showToast('Please select Slim or Poly.', { icon: 'error', highlightSelector: '#pdpSlimPolyField' });
      return;
    }

    const total = activePrice * qty;
    const paid = isPickup ? total : effectiveAmountPaid;
    const status = isPickup ? 'Paid' : panelStatus;

    setCart((current) => {
      const existing = current.find((i) => i.productId === selectedProduct.id && i.customer === customerName && !i.isBorrow && i.slimPoly === slimPoly);
      if (existing) {
        return current.map((i) => {
          if (i.id !== existing.id) return i;
          const newQty = i.qty + qty;
          const newTotal = i.price * newQty;
          const newPaid = (i.amountPaid || 0) + paid;
          return { ...i, qty: newQty, total: newTotal, amountPaid: newPaid, status: newPaid >= newTotal ? 'Paid' : newPaid > 0 ? 'Partial' : 'Utang' };
        });
      }
      return [...current, { id: `${selectedProduct.id}-${Date.now()}`, productId: selectedProduct.id, productName: selectedProduct.name, price: activePrice, qty, customer: customerName, location, pointPerson, total, amountPaid: paid, tip, notes, status, slimPoly, commissionRate: selectedProduct.commissionRate || 0, isNewCustomer, isBorrow: false }];
    });

    closePanel();
    showToast(`${selectedProduct.name} added to cart!`, { icon: 'check_circle' });
  }

  function addBorrowToCart() {
    if (!selectedBorrow) return;
    if (!chosenCustomer?.name) {
      showToast('Please select a customer.', { icon: 'error', highlightSelector: '#bdpCustomerSearch' });
      return;
    }
    if (chosenCustomer.isPickup) {
      showToast('Cannot record a borrow for Pickup Customer.', { icon: 'error' });
      return;
    }

    const qty = Math.max(1, quantity);
    const nameLower = (selectedBorrow.name || '').toLowerCase();
    const isGallon = nameLower.includes('gallon');
    const isDispenser = nameLower.includes('dispenser');

    setCart((current) => {
      const existing = current.find((i) => i.isBorrow && i.customer === chosenCustomer.name);
      if (existing) {
        return current.map((i) => {
          if (i.id !== existing.id) return i;
          const gallon = (i.gallon || 0) + (isGallon ? qty : 0);
          const dispenser = (i.dispenser || 0) + (isDispenser ? qty : 0);
          return { ...i, gallon, dispenser, qty: gallon + dispenser, productName: buildBorrowLabel(gallon, dispenser) };
        });
      }
      const gallon = isGallon ? qty : 0;
      const dispenser = isDispenser ? qty : 0;
      return [...current, { id: `${selectedBorrow.id}-${Date.now()}`, productId: selectedBorrow.id, productName: buildBorrowLabel(gallon, dispenser), qty: gallon + dispenser, gallon, dispenser, customer: chosenCustomer.name, location: chosenCustomer.location || '', pointPerson, total: 0, amountPaid: 0, status: 'Borrowed', isBorrow: true }];
    });

    closePanel();
    showToast(`${selectedBorrow.name} borrow recorded!`, { icon: 'inventory_2' });
  }

  function updateCartQty(index, delta) {
    setCart((current) => {
      const next = [...current];
      const item = next[index];
      if (!item) return current;
      const newQty = Math.max(0, (item.qty || 0) + delta);

      if (newQty === 0) {
        next.splice(index, 1);
        return next;
      }

      if (item.isBorrow) {
        const ratio = newQty / item.qty;
        const gallon = item.gallon ? Math.round(item.gallon * ratio) : 0;
        const dispenser = item.dispenser ? Math.round(item.dispenser * ratio) : 0;
        next[index] = { ...item, qty: newQty, gallon, dispenser, productName: buildBorrowLabel(gallon, dispenser) };
      } else {
        const updated = { ...item, qty: newQty, total: item.price * newQty };
        if (item.customer === 'Pickup Customer') {
          updated.amountPaid = updated.total;
          updated.status = 'Paid';
        } else {
          updated.amountPaid = Math.min(item.amountPaid || 0, updated.total);
          updated.status = updated.amountPaid >= updated.total ? 'Paid' : updated.amountPaid > 0 ? 'Partial' : 'Utang';
        }
        next[index] = updated;
      }
      return next;
    });
  }

  function openEditCartModal(index) {
    const item = cart[index];
    if (!item || item.isBorrow) return;

    const product = products.find((p) => p.id === item.productId) || { id: item.productId, name: item.productName, price: item.price, commissionRate: item.commissionRate || 0, pickupPrice: item.price };
    const customer = item.customer === 'Pickup Customer' ? PICKUP_CUSTOMER : customers.find((c) => c.name === item.customer && (c.location || '') === (item.location || '')) || { id: `edit-${index}`, name: item.customer, location: item.location || '', pointPerson: item.pointPerson || '' };

    setSelectedProduct(product);
    setSelectedBorrow(null);
    setPanelType('edit');
    setEditCartIndex(index);
    setChosenCustomer(customer);
    setCustomerQuery(customer.name || '');
    setCustomerDropdownOpen(false);
    setNewCustomerMode(false);
    setQuantity(item.qty || 1);
    setCustomPrice(item.price !== product.price ? item.price : null);
    setPriceEditOpen(false);
    setOverrideActive(false);
    setSlimPoly(item.slimPoly || '');
    setAmountPaid(item.amountPaid || 0);
    setTip(item.tip || 0);
    setNotes(item.notes || '');
    setPointPerson(item.pointPerson || '');
  }

  function closeEditCartModal() {
    setEditCartIndex(null);
    setSelectedProduct(null);
    setPanelType(null);
  }

  function saveEditCart() {
    if (editCartIndex === null) return;
    const item = cart[editCartIndex];
    if (!item) return;

    if (quantity < 1) {
      showToast('Please set a quantity.', { icon: 'error', highlightSelector: '#editCartQty' });
      return;
    }

    if (selectedProduct?.name === '5 Gallon' && !slimPoly) {
      showToast('Please select Slim or Poly.', { icon: 'error', highlightSelector: '#editCartSlimPolyField' });
      return;
    }

    const qty = Math.max(1, quantity);
    const total = activePrice * qty;
    const paid = isPickup ? total : effectiveAmountPaid;
    const status = isPickup ? 'Paid' : panelStatus;
    const customerName = chosenCustomer?.isPickup ? 'Pickup Customer' : (chosenCustomer?.name || item.customer);
    const location = chosenCustomer?.isPickup ? '' : (chosenCustomer?.location || item.location || '');

    setCart((current) => current.map((row, idx) => idx !== editCartIndex ? row : { ...row, price: activePrice, qty, total, amountPaid: paid, status, customer: customerName, location, pointPerson, slimPoly, tip, notes }));

    closeEditCartModal();
    showToast('Cart item updated.', { icon: 'check_circle' });
  }

  function removeCartItem(index) {
    setCart((current) => current.filter((_, idx) => idx !== index));
  }

  async function confirmCheckout() {
    if (!cart.length || checkoutLoading) return;

    if (!clientRequestIdRef.current) {
      clientRequestIdRef.current = generateClientRequestId();
    }

    setCheckoutLoading(true);
    const batchPayload = buildCheckoutPayload(cart, clientRequestIdRef.current);

    try {
      await completeSaleBatch(batchPayload);
      clientRequestIdRef.current = null;
      setShowCheckout(false);
      setCart([]);
      showToast('Sale completed!', { icon: 'check_circle' });
      flushSaleQueue().then(() => setQueueCount(getSaleQueue().length)).catch(() => {});
    } catch (err) {
      console.error('checkout error', err);
      if (err?.code === 'PGRST202') {
        showToast('Checkout is not set up yet. Run 001_complete_sale_batch.sql in Supabase SQL Editor.', { icon: 'error' });
        return;
      }
      enqueueSale(batchPayload);
      setQueueCount(getSaleQueue().length);
      clientRequestIdRef.current = null;
      setShowCheckout(false);
      setCart([]);
      showToast('Sale queued — will sync automatically.', { icon: 'schedule' });
    } finally {
      setCheckoutLoading(false);
    }
  }

  function shortProductName(name) {
    if (name.length <= 14) return name;
    return name.replace(/purified/i, 'Pur.').replace(/alkaline/i, 'Alk.').replace(/mineral/i, 'Min.').replace(/distilled/i, 'Dist.').replace(/gallon/i, 'Gal.').trim().substring(0, 14);
  }

  function renderOrderSummaryContent() {
    return (
      <>
        <div className="order-summary-table-wrap">
          <table className="order-summary-table">
            <thead>
              <tr>
                <th>Customer</th>
                {orderSummary.productNames.map((name) => (<th key={name} title={name}>{shortProductName(name)}</th>))}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orderSummary.rows.map((row) => (
                <tr key={row.customer}>
                  <td><div className="summary-customer-name" title={row.customer}>{row.customer}</div></td>
                  {orderSummary.productNames.map((name) => (
                    <td key={name}>{row.products[name] ? <span className="summary-qty-val">{row.products[name]}</span> : <span className="summary-qty-dash">—</span>}</td>
                  ))}
                  <td><span className={`summary-status-badge ${row.status === 'Paid' ? 'paid' : row.status === 'Partial' || row.status === 'Borrowed' ? 'partial' : 'utang'}`}>{row.status}</span></td>
                </tr>
              ))}
              <tr className="order-summary-totals-row">
                <td><strong>Total</strong></td>
                {orderSummary.productNames.map((name) => (<td key={name}><span className="summary-qty-val">{orderSummary.rows.reduce((sum, row) => sum + (row.products[name] || 0), 0) || '—'}</span></td>))}
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        <div className="order-summary-totals">
          <div className="order-summary-total-row">
            <span className="order-summary-total-label">Grand Total</span>
            <span className="order-summary-total-amount">{formatPeso(orderSummary.grandTotal)}</span>
          </div>
          {orderSummary.totalPaid > 0 && (
            <div className="order-summary-total-row order-summary-total-sub">
              <span>Amount Paid</span>
              <span className="text-success">{formatPeso(orderSummary.totalPaid)}</span>
            </div>
          )}
          {orderSummary.totalUtang > 0 && (
            <div className="order-summary-total-row order-summary-total-sub">
              <span>Outstanding (Utang)</span>
              <span className="text-danger">{formatPeso(orderSummary.totalUtang)}</span>
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="pos-wrapper">
      {loadingInit && (
        <div className="pos-loading">
          <div className="pos-loading-inner">
            <div className="loader" />
            <div>Loading POS data...</div>
          </div>
        </div>
      )}

      {initError && (
        <div className="pos-init-error">
          <div>{initError}</div>
          <div className="pos-init-actions">
            <button type="button" className="btn-ghost" onClick={() => window.location.reload()}>Reload page</button>
            <button type="button" className="btn-primary" onClick={loadInitial}>Retry</button>
          </div>
        </div>
      )}

      <div className="pos-products-row">
        <div className="pos-products-col">
          <div className="pos-col-header">
            <span className="material-icons-outlined">water_drop</span>
            <span>Products</span>
          </div>
          <div className="products-grid" id="productsGrid">
            {products.length ? products.filter((p) => String(p.type).toLowerCase() !== 'borrow').map((product) => (
              <div key={product.id} className="product-card" data-id={product.id} onClick={() => openProductPanel(product)}>
                <div className="product-icon-wrap"><span className="material-icons-outlined">water_drop</span></div>
                <div className="product-name">{product.name}</div>
                <div className="product-price">{formatPeso(product.price)}</div>
              </div>
            )) : <div className="pos-grid-empty">No products</div>}
          </div>
        </div>

        <div className="pos-products-col pos-borrow-col">
          <div className="pos-col-header pos-col-header-borrow">
            <span className="material-icons-outlined">swap_horiz</span>
            <span>Borrowed Items</span>
          </div>
          <div className="products-grid products-grid-borrow" id="borrowGrid">
            {borrowItems.length ? borrowItems.map((item) => (
              <div key={item.id} className="product-card product-card-borrow" data-id={item.id} onClick={() => openBorrowPanel(item)}>
                <div className="product-icon-wrap product-icon-borrow"><span className="material-icons-outlined">inventory_2</span></div>
                <div className="product-name">{item.name}</div>
                <div className="product-price product-borrow-label">Borrow</div>
              </div>
            )) : <div className="pos-grid-empty">No borrow items</div>}
          </div>
        </div>
      </div>

      <div className="cart-and-summary">
        <div className="cart-container" id="cartContainer">
          <div className="cart-container-header">
            <div className="cart-container-title">
              <span className="material-icons-outlined">shopping_cart</span>
              <span>Cart</span>
              <span className="cart-count-badge" id="cartCountBadge" style={{ display: cartCount > 0 ? '' : 'none' }}>{cartCount}</span>
            </div>
            <span className="cart-empty-msg" id="cartEmptyMsg" style={{ display: cart.length ? 'none' : '' }}>No items yet — tap a product to begin</span>
          </div>

          <div className="cart-items-list" id="cartItemsList">
            {cart.map((item, idx) => (
              <div key={item.id} className={`cart-row${item.isBorrow ? ' cart-row-borrow' : ''}`}>
                <div className="cart-row-product">
                  <div className={`cart-row-icon${item.isBorrow ? ' cart-row-icon-borrow' : ''}`}>
                    <span className="material-icons-outlined">{item.isBorrow ? 'inventory_2' : 'water_drop'}</span>
                  </div>
                  <div className="cart-row-info">
                    <div className="cart-row-name">{item.productName}{item.slimPoly ? ` (${item.slimPoly})` : ''}</div>
                    <div className="cart-row-meta"><span className="material-icons-outlined">person</span>{item.customer}{item.location ? <> · <span className="material-icons-outlined">location_on</span>{item.location}</> : null}</div>
                    <div className="cart-row-meta">
                      <span className={`badge ${item.isBorrow ? 'badge-warning' : item.status === 'Paid' ? 'badge-success' : item.status === 'Partial' ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: 11 }}>{item.isBorrow ? 'Borrow' : item.status}</span>
                      {item.pointPerson ? <> · {item.pointPerson}</> : null}
                      {item.tip > 0 ? <> · Tip: {formatPeso(item.tip)}</> : null}
                    </div>
                    {item.notes ? <div className="cart-row-meta cart-row-notes"><span className="material-icons-outlined">notes</span>{item.notes}</div> : null}
                  </div>
                </div>
                <div className="cart-row-right">
                  <div className="days-controls">
                    <button type="button" className="days-btn" onClick={() => updateCartQty(idx, -1)}>−</button>
                    <span className="days-val">{item.qty}</span>
                    <button type="button" className="days-btn" onClick={() => updateCartQty(idx, 1)}>+</button>
                  </div>
                  <div className="cart-row-total">{item.isBorrow ? <span className="cart-borrow-total-label">Borrow</span> : formatPeso(item.total)}</div>
                  {!item.isBorrow && (<button type="button" className="cart-row-edit" onClick={() => openEditCartModal(idx)} title="Edit order"><span className="material-icons-outlined">edit</span></button>)}
                  <button type="button" className="cart-row-remove" onClick={() => removeCartItem(idx)}><span className="material-icons-outlined">delete_outline</span></button>
                </div>
              </div>
            ))}
          </div>

          <div className="cart-footer" id="cartFooter" style={{ display: cart.length ? '' : 'none' }}>
            <div className="cart-grand-total">
              <span>Grand Total</span>
              <span className="cart-grand-amount" id="cartGrandTotal">{formatPeso(cartGrandTotal)}</span>
            </div>
            <button type="button" className="btn-primary cart-checkout-btn" id="completeSaleBtn" onClick={() => setShowCheckout(true)} disabled={!cart.length}>
              Checkout
              {queueCount > 0 && <span className="cart-queue-badge">{queueCount} queued</span>}
            </button>
          </div>
        </div>

        <div className="order-summary-panel" id="orderSummaryPanel">
          <div className="order-summary-header">
            <span className="material-icons-outlined">receipt_long</span>
            <span>Order Summary</span>
          </div>
          {!cart.length ? <div className="order-summary-empty" id="orderSummaryBody">Cart is empty</div> : <div id="orderSummaryBody">{renderOrderSummaryContent()}</div>}
        </div>
      </div>

      <div className={`product-detail-panel${panelType === 'product' ? ' open' : ''}`} id="productDetailPanel">
        <div className="pdp-header">
          <button type="button" className="pdp-close-btn" onClick={closePanel}><span className="material-icons-outlined">close</span></button>
          <div className="pdp-title">Add to Order</div>
        </div>
        <div className="pdp-body">
          <div className="pdp-product-info">
            <div className="pdp-product-icon"><span className="material-icons-outlined">water_drop</span></div>
            <div style={{ flex: 1 }}>
              <div className="pdp-product-name">{selectedProduct?.name || '—'}</div>
              <div className="pdp-price-row">
                <div className="pdp-product-price">{formatPeso(activePrice)}</div>
                <button type="button" className="pdp-edit-price-btn" title="Edit price" onClick={() => setPriceEditOpen((v) => !v)}><span className="material-icons-outlined">edit</span></button>
              </div>
              {overrideActive && <div className="pdp-override-indicator"><span className="material-icons-outlined">local_offer</span>Customer override price applied</div>}
              {priceEditOpen && (
                <div className="pdp-price-edit-wrap">
                  <input type="number" className="pdp-input pdp-price-input" placeholder="Custom price..." min="0" value={customPrice ?? selectedProduct?.price ?? ''} onChange={(e) => { const val = parseFloat(e.target.value); setCustomPrice(!Number.isNaN(val) && val >= 0 ? val : null); setOverrideActive(false); }} />
                  <button type="button" className="btn-exact pdp-price-save-btn" onClick={() => setPriceEditOpen(false)}>Set</button>
                  <button type="button" className="pdp-price-reset-btn" title="Reset" onClick={() => { setCustomPrice(null); setOverrideActive(false); setPriceEditOpen(false); }}><span className="material-icons-outlined">restart_alt</span></button>
                </div>
              )}
            </div>
          </div>

          <div className="pdp-field">
            <label className="pdp-label">Customer Name</label>
            <div className="custom-select-wrap" id="customerSelectWrap">
              {!chosenCustomer && !newCustomerMode && (
                <input type="text" id="pdpCustomerSearch" className="pdp-input" placeholder="Search customer..." value={customerQuery} onChange={(e) => { setCustomerQuery(e.target.value); setCustomerDropdownOpen(true); }} onFocus={() => setCustomerDropdownOpen(true)} autoComplete="off" />
              )}
              {customerDropdownOpen && !chosenCustomer && !newCustomerMode && (
                <div className="custom-select-dropdown open" id="customerDropdown">
                  <div className="csd-item csd-pickup" onClick={() => selectCustomer(PICKUP_CUSTOMER)}><div className="csd-name">🛍️ Pickup Customer</div><div className="csd-location"><span className="material-icons-outlined">storefront</span>Walk-in / No details needed</div></div>
                  <div className="csd-item csd-new" onClick={() => { setNewCustomerMode(true); setCustomerDropdownOpen(false); }}><span className="material-icons-outlined">person_add</span> New Customer</div>
                  {filteredCustomers.map((customer) => (
                    <div key={customer.id} className="csd-item" onClick={() => selectCustomer(customer)}>
                      <div className="csd-main-row"><span className="csd-name">{customer.name}</span>{customer.location ? <span className="csd-inline-location"><span className="material-icons-outlined">location_on</span>{customer.location}</span> : null}</div>
                      {customer.pointPerson ? <div className="csd-point-person"><span className="material-icons-outlined">badge</span>{customer.pointPerson}</div> : null}
                    </div>
                  ))}
                  {customerQuery && !filteredCustomers.length && <div className="csd-item csd-empty">No customers found</div>}
                </div>
              )}
            </div>
            <div className="pdp-selected-customer" id="pdpSelectedCustomer" style={{ display: chosenCustomer && !newCustomerMode ? '' : 'none' }}>
              <span className="pdp-selected-name" id="pdpSelectedName">{chosenCustomer?.isPickup ? '🛍️ Pickup Customer' : chosenCustomer?.name || ''}</span>
              <span className="pdp-selected-location" id="pdpSelectedLocation">{chosenCustomer?.isPickup ? 'Walk-in / No details needed' : (chosenCustomer?.location || '')}</span>
              <button type="button" className="pdp-clear-customer" id="pdpClearCustomer" onClick={() => { setChosenCustomer(null); setCustomerQuery(''); setCustomPrice(null); setOverrideActive(false); setAmountPaid(0); }}><span className="material-icons-outlined">close</span></button>
            </div>
          </div>

          {newCustomerMode && (
            <div id="pdpNewCustomerFields">
              <button type="button" className="pdp-back-btn" onClick={() => { setNewCustomerMode(false); setNewCustomerName(''); setNewCustomerLocation(''); }}><span className="material-icons-outlined">arrow_back</span> Back</button>
              <div className="pdp-field"><label className="pdp-label">New Customer Name</label><input type="text" className="pdp-input" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Enter full name..." /></div>
              <div className="pdp-field"><label className="pdp-label">Location</label><input type="text" className="pdp-input" value={newCustomerLocation} onChange={(e) => setNewCustomerLocation(e.target.value)} placeholder="Enter location..." /></div>
            </div>
          )}

          <div className="pdp-field">
            <label className="pdp-label">Point Person</label>
            <select id="bdpPointPerson" className="pdp-select" value={pointPerson} onChange={(e) => setPointPerson(e.target.value)}>
              <option value="">Select staff...</option>
              {staffList.map((s) => <option key={s.id} value={s.name}>{s.name}{s.role ? ` (${s.role})` : ''}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
            <div className="pdp-field" style={{ marginBottom: 0 }}>
              <label className="pdp-label">Quantity</label>
              <div className="pdp-qty-row">
                <button type="button" className="qty-btn" id="pdpQtyMinus" onClick={() => setQuantity((q) => Math.max(0, q - 1))}>−</button>
                <input id="pdpQty" type="number" className="pdp-qty-input" value={quantity} min="0" onChange={(e) => setQuantity(Math.max(0, Number(e.target.value) || 0))} />
                <button type="button" className="qty-btn" id="pdpQtyPlus" onClick={() => setQuantity((q) => q + 1)}>+</button>
              </div>
            </div>
            {selectedProduct?.name === '5 Gallon' && (
              <div id="pdpSlimPolyField" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 0 }}>
                <label className="pdp-label">Container Type <span style={{ color: 'var(--destructive)' }}>*</span></label>
                <div className="pdp-radio-group">
                  <label className="pdp-radio-label"><input type="radio" name="slimPoly" value="Slim" checked={slimPoly === 'Slim'} onChange={() => setSlimPoly('Slim')} /> Slim</label>
                  <label className="pdp-radio-label"><input type="radio" name="slimPoly" value="Poly" checked={slimPoly === 'Poly'} onChange={() => setSlimPoly('Poly')} /> Poly</label>
                </div>
              </div>
            )}
          </div>

          <div className="pdp-total-row"><span className="pdp-total-label">Total Amount</span><span className="pdp-total-amount" id="pdpTotal">{formatPeso(panelTotal)}</span></div>
          <div className="pdp-payment-section">
            <label className="pdp-label">Amount Paid</label>
            <div className="pdp-amount-row">
              <input type="number" className="pdp-input" id="pdpAmountPaid" placeholder="0.00" min="0" value={amountPaid} onChange={(e) => setAmountPaid(Number(e.target.value) || 0)} />
              <button type="button" className="btn-exact" id="pdpExactBtn" onClick={() => setAmountPaid(panelTotal)}>Exact</button>
            </div>
            <div className={`pdp-status-pill ${panelStatus === 'Paid' ? 'status-paid' : panelStatus === 'Partial' ? 'status-partial' : 'status-utang'}`} id="pdpStatusPill">
              <span className="material-icons-outlined">{panelStatus === 'Paid' ? 'check_circle' : panelStatus === 'Partial' ? 'pie_chart' : 'schedule'}</span>
              <span id="pdpStatusText">{panelStatus}</span>
            </div>
          </div>
          <div className="pdp-field">
            <label className="pdp-label">Tip <span style={{ color: 'var(--muted-fg)', fontWeight: 400 }}>(optional)</span></label>
            <input type="number" className="pdp-input" id="pdpTip" placeholder="0.00" min="0" value={tip} onChange={(e) => setTip(Number(e.target.value) || 0)} />
          </div>
          <div className="pdp-field">
            <label className="pdp-label">Notes <span style={{ color: 'var(--muted-fg)', fontWeight: 400 }}>(optional)</span></label>
            <input type="text" className="pdp-input" id="pdpNotes" placeholder="Add a note..." value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <button type="button" className="btn-primary" id="pdpAddToCart" onClick={addProductToCart}>Add to Cart</button>
        </div>
      </div>

      <div className={`product-detail-panel${panelType === 'borrow' ? ' open' : ''}`} id="borrowDetailPanel">
        <div className="pdp-header">
          <button type="button" className="pdp-close-btn" onClick={closePanel}><span className="material-icons-outlined">close</span></button>
          <div className="pdp-title">Record Borrowed Item</div>
        </div>
        <div className="pdp-body">
          <div className="pdp-product-info" style={{ background: 'hsl(38,90%,94%)', border: '1px solid hsl(38,70%,80%)' }}>
            <div className="pdp-product-icon" style={{ background: 'hsl(38,70%,55%)' }}><span className="material-icons-outlined">inventory_2</span></div>
            <div>
              <div className="pdp-product-name">{selectedBorrow?.name || '—'}</div>
              <div className="pdp-product-price" style={{ color: 'hsl(38,70%,35%)', fontSize: 14 }}>Borrowed Item — No charge</div>
            </div>
          </div>
          <div className="pdp-field">
            <label className="pdp-label">Customer Name</label>
            <div className="custom-select-wrap" id="bdpCustomerSelectWrap">
              {!chosenCustomer && (
                <input type="text" className="pdp-input" id="bdpCustomerSearch" placeholder="Search customer..." value={customerQuery} onChange={(e) => { setCustomerQuery(e.target.value); setCustomerDropdownOpen(true); }} onFocus={() => setCustomerDropdownOpen(true)} autoComplete="off" />
              )}
              {customerDropdownOpen && !chosenCustomer && (
                <div className="custom-select-dropdown open" id="bdpCustomerDropdown">
                  {filteredCustomers.map((customer) => (
                    <div key={customer.id} className="csd-item" onClick={() => selectCustomer(customer)}>
                      <div className="csd-name">{customer.name}</div>
                      {customer.location && <div className="csd-location">{customer.location}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {chosenCustomer && (<div className="pdp-selected-customer" id="bdpSelectedCustomer"><span className="pdp-selected-name" id="bdpSelectedName">{chosenCustomer.name}</span><span className="pdp-selected-location" id="bdpSelectedLocation">{chosenCustomer.location || ''}</span><button type="button" className="pdp-clear-customer" id="bdpClearCustomer" onClick={() => { setChosenCustomer(null); setCustomerQuery(''); }}><span className="material-icons-outlined">close</span></button></div>)}
          </div>

          <div className="pdp-field">
            <label className="pdp-label">Point Person</label>
            <select className="pdp-select" value={pointPerson} onChange={(e) => setPointPerson(e.target.value)}>
              <option value="">Select staff...</option>
              {staffList.map((s) => <option key={s.id} value={s.name}>{s.name}{s.role ? ` (${s.role})` : ''}</option>)}
            </select>
          </div>

          <div className="pdp-field">
            <label className="pdp-label">Quantity</label>
            <div className="pdp-qty-row">
              <button type="button" className="qty-btn" id="bdpQtyMinus" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
              <input id="bdpQty" type="number" className="pdp-qty-input" value={quantity} min="1" onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
              <button type="button" className="qty-btn" id="bdpQtyPlus" onClick={() => setQuantity((q) => q + 1)}>+</button>
            </div>
          </div>

          <button type="button" className="btn-primary" id="bdpAddToCart" style={{ background: 'hsl(38,70%,50%)', borderColor: 'hsl(38,70%,45%)' }} onClick={addBorrowToCart}>Record Borrow</button>
        </div>
      </div>

      {panelType === 'edit' && editCartIndex !== null && (
        <div className="pdp-overlay show" onClick={closeEditCartModal}>
          <div className="product-detail-panel edit-modal open" id="productDetailPanelEdit" onClick={(e) => e.stopPropagation()}>
            <div className="pdp-header">
              <button type="button" className="pdp-close-btn" id="editCartClose" onClick={closeEditCartModal}><span className="material-icons-outlined">close</span></button>
              <div className="pdp-title">Edit Order</div>
            </div>
            <div className="pdp-body">
              <div className="pdp-product-info" id="editCartProductInfo">
                <div className="pdp-product-icon"><span className="material-icons-outlined">{selectedProduct ? (selectedProduct.icon || 'water_drop') : 'water_drop'}</span></div>
                <div style={{ flex: 1 }}>
                  <div className="pdp-product-name" id="editCartProductName">{selectedProduct?.name || '—'}</div>
                  <div className="pdp-product-price" id="editCartProductPrice">{formatPeso(activePrice)}</div>
                </div>
              </div>
              <div className="pdp-field">
                <label className="pdp-label">Customer Name</label>
                <div className="custom-select-wrap" id="editCartCustomerSelectWrap">
                  <input type="text" className="pdp-input" id="editCartCustomerSearch" placeholder="Search customer..." autoComplete="off" style={{ display: 'none' }} value={customerQuery} onChange={(e) => { setCustomerQuery(e.target.value); setCustomerDropdownOpen(true); }} />
                  {customerDropdownOpen && !chosenCustomer && (
                    <div className="custom-select-dropdown open" id="editCartCustomerDropdown">
                      <div className="csd-item csd-pickup" onClick={() => selectCustomer(PICKUP_CUSTOMER)}><div className="csd-name">🛍️ Pickup Customer</div><div className="csd-location"><span className="material-icons-outlined">storefront</span>Walk-in / No details needed</div></div>
                      <div className="csd-item csd-new" onClick={() => { setNewCustomerMode(true); setCustomerDropdownOpen(false); }}><span className="material-icons-outlined">person_add</span> New Customer</div>
                      {filteredCustomers.map((customer) => (
                        <div key={customer.id} className="csd-item" onClick={() => selectCustomer(customer)}>
                          <div className="csd-main-row"><span className="csd-name">{customer.name}</span>{customer.location ? <span className="csd-inline-location"><span className="material-icons-outlined">location_on</span>{customer.location}</span> : null}</div>
                          {customer.pointPerson ? <div className="csd-point-person"><span className="material-icons-outlined">badge</span>{customer.pointPerson}</div> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="pdp-selected-customer" id="editCartSelectedCustomer" style={{ display: chosenCustomer ? 'flex' : 'none' }}>
                  <span className="pdp-selected-name" id="editCartSelectedName">{chosenCustomer?.name || ''}</span>
                  <span className="pdp-selected-location" id="editCartSelectedLocation">{chosenCustomer?.location || ''}</span>
                  <button type="button" className="pdp-clear-customer" id="editCartClearCustomer" onClick={() => { setChosenCustomer(null); setCustomerQuery(''); }}><span className="material-icons-outlined">close</span></button>
                </div>
              </div>
              <div className="pdp-field" id="editCartLocationField"><label className="pdp-label">Location</label><input type="text" className="pdp-input" id="editCartLocation" placeholder="Auto-filled from customer" readOnly value={chosenCustomer?.location || ''} /></div>
              <div className="pdp-field"><label className="pdp-label">Point Person</label><select className="pdp-select" id="editCartPointPerson" value={pointPerson} onChange={(e) => setPointPerson(e.target.value)}><option value="">Select staff...</option>{staffList.map((s) => <option key={s.id} value={s.name}>{s.name}{s.role ? ` (${s.role})` : ''}</option>)}</select></div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
                <div className="pdp-field" style={{ marginBottom: 0 }}>
                  <label className="pdp-label">Quantity</label>
                  <div className="pdp-qty-row">
                    <button type="button" className="qty-btn" id="editCartQtyMinus" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>−</button>
                    <input type="number" className="pdp-qty-input" id="editCartQty" value={quantity} min="1" onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
                    <button type="button" className="qty-btn" id="editCartQtyPlus" onClick={() => setQuantity((q) => q + 1)}>+</button>
                  </div>
                </div>
                {selectedProduct?.name === '5 Gallon' && (
                  <div id="editCartSlimPolyField" style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 0 }}>
                    <label className="pdp-label">Container Type <span style={{ color: 'var(--destructive)' }}>*</span></label>
                    <div className="pdp-radio-group">
                      <label className="pdp-radio-label"><input type="radio" name="editSlimPoly" value="Slim" checked={slimPoly === 'Slim'} onChange={() => setSlimPoly('Slim')} /> Slim</label>
                      <label className="pdp-radio-label"><input type="radio" name="editSlimPoly" value="Poly" checked={slimPoly === 'Poly'} onChange={() => setSlimPoly('Poly')} /> Poly</label>
                    </div>
                  </div>
                )}
              </div>
              <div className="pdp-total-row"><span className="pdp-total-label">Total Amount</span><span className="pdp-total-amount" id="editCartTotal">{formatPeso(panelTotal)}</span></div>
              <div className="pdp-payment-section">
                <label className="pdp-label">Amount Paid</label>
                <div className="pdp-amount-row">
                  <input type="number" className="pdp-input" id="editCartAmountPaid" placeholder="0.00" min="0" value={amountPaid} onChange={(e) => setAmountPaid(Number(e.target.value) || 0)} />
                  <button type="button" className="btn-exact" id="editCartExactBtn" onClick={() => setAmountPaid(panelTotal)}>Exact</button>
                </div>
                <div className={`pdp-status-pill ${panelStatus === 'Paid' ? 'status-paid' : panelStatus === 'Partial' ? 'status-partial' : 'status-utang'}`} id="editCartStatusPill">
                  <span className="material-icons-outlined">{panelStatus === 'Paid' ? 'check_circle' : panelStatus === 'Partial' ? 'pie_chart' : 'schedule'}</span>
                  <span id="editCartStatusText">{panelStatus === 'Partial' ? `Partial — ${formatPeso(panelTotal - effectiveAmountPaid)} remaining` : panelStatus}</span>
                </div>
              </div>
              <div className="edit-modal-actions">
                <button type="button" className="btn-primary edit-modal-save" id="editCartSave" onClick={saveEditCart}><span className="material-icons-outlined">check</span> Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className={`pdp-overlay${panelType && panelType !== 'edit' ? ' show' : ''}`} onClick={closePanel} />

      <div className={`pay-modal-overlay${showCheckout ? ' show' : ''}`} id="checkoutConfirmOverlay">
        <div className="pay-modal checkout-confirm-modal">
          <div className="pay-modal-header">
            <div className="checkout-confirm-title"><span className="material-icons-outlined">receipt_long</span>Confirm Order</div>
            <button type="button" className="pdp-close-btn" id="checkoutConfirmClose" onClick={() => setShowCheckout(false)}><span className="material-icons-outlined">close</span></button>
          </div>
          <div className="pay-modal-body checkout-confirm-body">
            <div className="checkout-confirm-summary" id="checkoutConfirmSummary"><div className="checkout-confirm-summary-inner">{renderOrderSummaryContent()}</div></div>
            <div className="checkout-confirm-totals" id="checkoutConfirmTotals" />
            <div className="checkout-confirm-actions">
              <button type="button" className="btn-cancel-delete" id="checkoutConfirmCancel" onClick={() => setShowCheckout(false)} disabled={checkoutLoading}>Back to Cart</button>
              <button type="button" className="btn-primary checkout-confirm-btn" id="checkoutConfirmProceed" onClick={confirmCheckout} disabled={checkoutLoading}><span className="material-icons-outlined">{checkoutLoading ? 'hourglass_empty' : 'check_circle'}</span>{checkoutLoading ? 'Processing...' : 'Confirm & Process'}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
