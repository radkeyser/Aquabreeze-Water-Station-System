import React, { useCallback, useEffect, useState } from 'react';
import { addSupplier, deleteSupplier, getSuppliers, updateSupplier } from '../../../api/settings';
import { formatPeso } from '../../../utils/format';
import SettingsModal from './SettingsModal';
import './settings.css';

function cell(v) {
  if (v > 0) return v;
  return <span style={{ color: 'var(--border)' }}>—</span>;
}

function priceCell(v) {
  if (v > 0) return formatPeso(v);
  return <span style={{ color: 'var(--border)' }}>—</span>;
}

function handleApiError(err, showToast) {
  if (err?.code === 'PGRST202') {
    showToast('Settings RPC not set up. Run 006_settings_rpc.sql in Supabase SQL Editor.', { icon: 'error', type: 'error' });
  } else {
    showToast(err?.message || 'Something went wrong.', { icon: 'error', type: 'error' });
  }
}

const emptyForm = {
  name: '',
  qty500: '',
  price500: '',
  qty1000: '',
  price1000: '',
  qtyGallon: '',
  priceGallon: '',
};

export default function SuppliersTab({ showToast }) {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSuppliers();
      setSuppliers(data);
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

  function openEdit(s) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      qty500: s.qty500 ? String(s.qty500) : '',
      price500: s.price500 ? String(s.price500) : '',
      qty1000: s.qty1000 ? String(s.qty1000) : '',
      price1000: s.price1000 ? String(s.price1000) : '',
      qtyGallon: s.qtyGallon ? String(s.qtyGallon) : '',
      priceGallon: s.priceGallon ? String(s.priceGallon) : '',
    });
    setModalOpen(true);
  }

  async function handleSave() {
    const name = form.name.trim();
    if (!name) {
      showToast('Please enter a supplier name.', { icon: 'warn', type: 'warn' });
      return;
    }

    const payload = {
      name,
      qty500: parseFloat(form.qty500) || 0,
      price500: parseFloat(form.price500) || 0,
      qty1000: parseFloat(form.qty1000) || 0,
      price1000: parseFloat(form.price1000) || 0,
      qtyGallon: parseFloat(form.qtyGallon) || 0,
      priceGallon: parseFloat(form.priceGallon) || 0,
    };

    setSubmitting(true);
    try {
      const result = editingId
        ? await updateSupplier(editingId, payload)
        : await addSupplier(payload);
      showToast(result.message, { type: 'success' });
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
      const result = await deleteSupplier(deleteTarget.id);
      showToast(result.message, { type: 'success' });
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
          <div className="cfg-tab-title">Suppliers</div>
          <div className="cfg-tab-sub">{suppliers.length} suppliers</div>
        </div>
        <button type="button" className="cfg-save-btn" onClick={openAdd}>
          <span className="material-icons-outlined">add</span>
          Add Supplier
        </button>
      </div>

      <div className="card">
        <div className="card-body" style={{ overflowX: 'auto', padding: 20 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th style={{ textAlign: 'center' }}>500mL<br /><small>Pcs/Bag</small></th>
                <th style={{ textAlign: 'center' }}>500mL<br /><small>Price</small></th>
                <th style={{ textAlign: 'center' }}>1000mL<br /><small>Pcs/Bag</small></th>
                <th style={{ textAlign: 'center' }}>1000mL<br /><small>Price</small></th>
                <th style={{ textAlign: 'center' }}>Slim<br /><small>Pcs/Bag</small></th>
                <th style={{ textAlign: 'center' }}>Slim<br /><small>Price</small></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {!suppliers.length ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--muted-fg)' }}>
                    No suppliers found
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id}>
                    <td style={{ color: 'var(--muted-fg)', fontSize: 12 }}>{s.id}</td>
                    <td className="text-bold">{s.name}</td>
                    <td style={{ textAlign: 'center' }}>{cell(s.qty500)}</td>
                    <td style={{ textAlign: 'center' }}>{priceCell(s.price500)}</td>
                    <td style={{ textAlign: 'center' }}>{cell(s.qty1000)}</td>
                    <td style={{ textAlign: 'center' }}>{priceCell(s.price1000)}</td>
                    <td style={{ textAlign: 'center' }}>{cell(s.qtyGallon)}</td>
                    <td style={{ textAlign: 'center' }}>{priceCell(s.priceGallon)}</td>
                    <td>
                      <div className="payroll-actions">
                        <button type="button" className="payroll-edit-btn" onClick={() => openEdit(s)} aria-label="Edit">
                          <span className="material-icons-outlined">edit</span>
                        </button>
                        <button
                          type="button"
                          className="payroll-delete-btn"
                          onClick={() => setDeleteTarget(s)}
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
        title={editingId ? 'Edit Supplier' : 'Add Supplier'}
        maxWidth={480}
      >
        <div className="pdp-field">
          <label className="pdp-label" htmlFor="suppName">Supplier Name</label>
          <input
            id="suppName"
            type="text"
            className="pdp-input"
            placeholder="Name..."
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="pdp-field">
            <label className="pdp-label" htmlFor="supp500qty">500mL Pcs/Bag</label>
            <input
              id="supp500qty"
              type="number"
              className="pdp-input"
              placeholder="0"
              min={0}
              value={form.qty500}
              onChange={(e) => setForm((f) => ({ ...f, qty500: e.target.value }))}
            />
          </div>
          <div className="pdp-field">
            <label className="pdp-label" htmlFor="supp500price">500mL Price/Bag</label>
            <input
              id="supp500price"
              type="number"
              className="pdp-input"
              placeholder="0.00"
              min={0}
              value={form.price500}
              onChange={(e) => setForm((f) => ({ ...f, price500: e.target.value }))}
            />
          </div>
          <div className="pdp-field">
            <label className="pdp-label" htmlFor="supp1000qty">1000mL Pcs/Bag</label>
            <input
              id="supp1000qty"
              type="number"
              className="pdp-input"
              placeholder="0"
              min={0}
              value={form.qty1000}
              onChange={(e) => setForm((f) => ({ ...f, qty1000: e.target.value }))}
            />
          </div>
          <div className="pdp-field">
            <label className="pdp-label" htmlFor="supp1000price">1000mL Price/Bag</label>
            <input
              id="supp1000price"
              type="number"
              className="pdp-input"
              placeholder="0.00"
              min={0}
              value={form.price1000}
              onChange={(e) => setForm((f) => ({ ...f, price1000: e.target.value }))}
            />
          </div>
          <div className="pdp-field">
            <label className="pdp-label" htmlFor="suppGallonqty">Slim Gallon Pcs</label>
            <input
              id="suppGallonqty"
              type="number"
              className="pdp-input"
              placeholder="0"
              min={0}
              value={form.qtyGallon}
              onChange={(e) => setForm((f) => ({ ...f, qtyGallon: e.target.value }))}
            />
          </div>
          <div className="pdp-field">
            <label className="pdp-label" htmlFor="suppGallonprice">Slim Gallon Price</label>
            <input
              id="suppGallonprice"
              type="number"
              className="pdp-input"
              placeholder="0.00"
              min={0}
              value={form.priceGallon}
              onChange={(e) => setForm((f) => ({ ...f, priceGallon: e.target.value }))}
            />
          </div>
        </div>
        <button type="button" className="btn-primary" disabled={submitting} onClick={handleSave}>
          {submitting ? 'Saving...' : 'Save'}
        </button>
      </SettingsModal>

      <SettingsModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Supplier"
        maxWidth={360}
      >
        <div className="pay-modal-info">
          <div className="pay-modal-customer">{deleteTarget?.name || '--'}</div>
          <div className="pay-modal-debt" style={{ color: 'var(--destructive)' }}>
            This will permanently remove the supplier.
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
