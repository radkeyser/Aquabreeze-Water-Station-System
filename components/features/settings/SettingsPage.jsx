import React, { useCallback, useEffect, useState } from 'react';
import ProductsTab from './ProductsTab.jsx';
import SuppliersTab from './SuppliersTab.jsx';
import OthersTab from './OthersTab.jsx';
import '../../../src/settings.css';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('products');
  const [toast, setToast] = useState('');

  const showToast = useCallback((message) => setToast(message), []);

  useEffect(() => {
    if (!toast) return undefined;
    const id = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(id);
  }, [toast]);

  return (
    <div className="p-4 settings-page">
      <div className="cfg-tab-bar">
        <button
          type="button"
          className={`cfg-tab${activeTab === 'products' ? ' active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          <span className="material-icons-outlined">inventory_2</span>
          Products
        </button>
        <button
          type="button"
          className={`cfg-tab${activeTab === 'suppliers' ? ' active' : ''}`}
          onClick={() => setActiveTab('suppliers')}
        >
          <span className="material-icons-outlined">local_shipping</span>
          Suppliers
        </button>
        <button
          type="button"
          className={`cfg-tab${activeTab === 'others' ? ' active' : ''}`}
          onClick={() => setActiveTab('others')}
        >
          <span className="material-icons-outlined">tune</span>
          Others
        </button>
      </div>

      <div className="settings-tab-content">
        {activeTab === 'products' && <ProductsTab showToast={showToast} />}
        {activeTab === 'suppliers' && <SuppliersTab showToast={showToast} />}
        {activeTab === 'others' && <OthersTab showToast={showToast} />}
      </div>

      {toast && <div className="toast-message">{toast}</div>}
    </div>
  );
}
