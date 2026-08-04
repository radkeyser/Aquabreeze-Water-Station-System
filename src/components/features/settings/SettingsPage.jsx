import React, { useState } from 'react';
import ProductsTab from './ProductsTab.jsx';
import SuppliersTab from './SuppliersTab.jsx';
import OthersTab from './OthersTab.jsx';
import { showToast } from '../../../utils/toast.js';
import './settings.css';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('products');

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

      </div>
  );
}
