import React, { useCallback, useEffect, useState } from 'react';
import { addProduct, deleteProduct, getProducts, updateProduct } from '../../../api/settings';
import { formatPeso } from '../../../utils/format';
import SettingsModal from './SettingsModal';
import './settings.css';

function OptPeso({ value }) {
  if (value > 0) return formatPeso(value);
  return <span style={{ color: 'var(--muted-fg)' }}>—</span>;
}

function handleApiError(err, showToast) {
  if (err?.code === 'PGRST202') {
    showToast('Settings RPC not set up. Run 006_settings_rpc.sql in Supabase SQL Editor.');
  } else {
    showToast(err?.message || 'Something went wrong.');
  }
}

const emptyForm = {
  name: '',
  price: '',
  pickupPrice: '',
  commissionRate: '',
  type: 'Product',
};

export default function ProductsTab({ showToast }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (err) {
      handleApiError(err, showToast);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  }

  function openEdit(product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      price: String(product.price),
      pickupPrice: product.pickupPrice > 0 ? String(product.pickupPrice) : '',
      commissionRate: String(product.commissionRate),
      type: product.type || 'Product',
    });
    setModalOpen(true);
  }

  async function handleSave() {
    const name = form.name.trim();
    if (!name) {
      showToast('Please enter a product name.');
      return;
    }

    const payload = {
      name,
      price: parseFloat(form.price) || 0,
      pickupPrice: parseFloat(form.pickupPrice) || 0,
      commissionRate: parseFloat(form.commissionRate) || 0,
      type: form.type,
    };

    setSubmitting(true);
    try {
      const result = editingId
        ? await updateProduct(editingId, payload)
        : await addProduct(payload);
      showToast(result.message);
      if (result.success) {
        setModalOpen(false);
        await load();
      }
    } catch (err) {
      handleApiError(err, showToast);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      const result = await deleteProduct(deleteTarget.id);
      showToast(result.message);
      if (result.success) {
        setDeleteTarget(null);
        await load();
      }
    } catch (err) {
      handleApiError(err, showToast);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="settings-loading">
        <div className="loading-spinner"><div className="spinner" /></div>
      </div>
    );
  }

  return (
    <div className="cfg-tab-panel">
      <div className="cfg-tab-header">
        <div>
          <div className="cfg-tab-title">Products</div>
          <div className="cfg-tab-sub">{products.length} products</div>
        </div>
        <button type="button" className="cfg-save-btn" onClick={openAdd}>
          <span className="material-icons-outlined">add</span>
          Add Product
        </button>
      </div>

      <div className="card">
        <div className="card-body" style={{ overflowX: 'auto', padding: 20 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Price</th>
                <th>Pickup Price</th>
                <th>Commission Rate</th>
                <th>Type</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!products.length ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--muted-fg)' }}>
                    No products found
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id}>
                    <td style={{ color: 'var(--muted-fg)', fontSize: 12 }}>{p.id}</td>
                    <td className="text-bold">{p.name}</td>
                    <td>{formatPeso(p.price)}</td>
                    <td><OptPeso value={p.pickupPrice} /></td>
                    <td><OptPeso value={p.commissionRate} /></td>
                    <td>
                      <span className={`badge ${p.type === 'Product' ? 'badge-success' : 'badge-warning'}`}>
                        {p.type}
                      </span>
                    </td>
                    <td>
                      <div className="payroll-actions">
                        <button type="button" className="payroll-edit-btn" onClick={() => openEdit(p)} aria-label="Edit">
                          <span className="material-icons-outlined">edit</span>
                        </button>
                        <button
                          type="button"
                          className="payroll-delete-btn"
                          onClick={() => setDeleteTarget(p)}
                          aria-label="Delete"
                        >
                          <span className="material-icons-outlined">delete_outline</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SettingsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? 'Edit Product' : 'Add Product'}
      >
        <div className="pdp-field">
          <label className="pdp-label" htmlFor="prodName">Name</label>
          <input
            id="prodName"
            type="text"
            className="pdp-input"
            placeholder="Product name..."
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="pdp-field">
          <label className="pdp-label" htmlFor="prodPrice">Price</label>
          <input
            id="prodPrice"
            type="number"
            className="pdp-input"
            placeholder="0.00"
            min={0}
            step={0.01}
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
        </div>
        <div className="pdp-field">
          <label className="pdp-label" htmlFor="prodPickup">
            Pickup Price <span style={{ color: 'var(--muted-fg)', fontWeight: 400 }}>(optional)</span>
          </label>
          <input
            id="prodPickup"
            type="number"
            className="pdp-input"
            placeholder="Leave blank to use Price"
            min={0}
            step={0.01}
            value={form.pickupPrice}
            onChange={(e) => setForm((f) => ({ ...f, pickupPrice: e.target.value }))}
          />
        </div>
        <div className="pdp-field">
          <label className="pdp-label" htmlFor="prodCommission">Commission Rate (per unit)</label>
          <input
            id="prodCommission"
            type="number"
            className="pdp-input"
            placeholder="0.00"
            min={0}
            step={0.01}
            value={form.commissionRate}
            onChange={(e) => setForm((f) => ({ ...f, commissionRate: e.target.value }))}
          />
        </div>
        <div className="pdp-field">
          <label className="pdp-label" htmlFor="prodType">Type</label>
          <select
            id="prodType"
            className="pdp-select"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="Product">Product</option>
            <option value="Borrow">Borrow</option>
          </select>
        </div>
        <button type="button" className="btn-primary" disabled={submitting} onClick={handleSave}>
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </SettingsModal>

      <SettingsModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Product"
        maxWidth={360}
      >
        <div className="pay-modal-info">
          <div className="pay-modal-customer">{deleteTarget?.name || '--'}</div>
          <div className="pay-modal-debt" style={{ color: 'var(--destructive)' }}>
            This will permanently remove the product.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" className="btn-cancel-delete" onClick={() => setDeleteTarget(null)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ background: 'var(--destructive)', flex: 1 }}
            disabled={submitting}
            onClick={handleDelete}
          >
            {submitting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </SettingsModal>
    </div>
  );
}
