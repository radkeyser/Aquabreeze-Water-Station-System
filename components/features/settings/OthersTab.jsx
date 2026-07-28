import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { getConfigData, saveConfigData } from '../../../src/api/settings.js';
import '../../../src/settings.css';

function buildItems(data, type) {
  return data.map((item, index) => ({ id: `${type}-${index}`, value: item }));
}

export default function OthersTab({ showToast }) {
  const [roles, setRoles] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getConfigData();
      setRoles(data.roles || []);
      setExpenses(data.expenses || []);
    } catch (err) {
      showToast(err?.message || 'Failed to load settings.');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const rolesList = useMemo(() => buildItems(roles, 'role'), [roles]);
  const expensesList = useMemo(() => buildItems(expenses, 'expense'), [expenses]);

  function updateRole(index, value) {
    setRoles((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  }

  function updateExpense(index, value) {
    setExpenses((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  }

  function addRole() {
    setRoles((prev) => [...prev, '']);
  }

  function addExpense() {
    setExpenses((prev) => [...prev, '']);
  }

  function removeRole(index) {
    setRoles((prev) => prev.filter((_, idx) => idx !== index));
  }

  function removeExpense(index) {
    setExpenses((prev) => prev.filter((_, idx) => idx !== index));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        roles: roles.map((item) => item.trim()).filter(Boolean),
        expenses: expenses.map((item) => item.trim()).filter(Boolean),
      };
      const result = await saveConfigData(payload);
      showToast(result.message || 'Config saved!');
      if (result.success) {
        await load();
      }
    } catch (err) {
      showToast(err?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
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
      <div className="settings-two-col">
        <div className="cfg-card">
          <div className="cfg-card-header">
            <div className="cfg-icon teal"><span className="material-icons-outlined">badge</span></div>
            <div>
              <div className="cfg-card-title">Roles</div>
              <div className="cfg-card-desc">Staff roles available for assignment</div>
            </div>
          </div>
          <div className="cfg-card-body">
            {rolesList.length ? rolesList.map((item, index) => (
              <div className="cfg-list-item" key={item.id}>
                <input
                  type="text"
                  className="pdp-input cfg-list-input"
                  value={roles[index]}
                  onChange={(e) => updateRole(index, e.target.value)}
                />
                <button
                  type="button"
                  className="payroll-delete-btn"
                  onClick={() => removeRole(index)}
                  aria-label="Remove role"
                >
                  <span className="material-icons-outlined">delete_outline</span>
                </button>
              </div>
            )) : (
              <div className="text-muted">No roles defined yet.</div>
            )}
            <button type="button" className="inv-btn-ghost" onClick={addRole}>
              <span className="material-icons-outlined">add</span> Add Role
            </button>
          </div>
        </div>

        <div className="cfg-card">
          <div className="cfg-card-header">
            <div className="cfg-icon amber"><span className="material-icons-outlined">receipt</span></div>
            <div>
              <div className="cfg-card-title">Expense Suggestions</div>
              <div className="cfg-card-desc">Frequently used expense names</div>
            </div>
          </div>
          <div className="cfg-card-body">
            {expensesList.length ? expensesList.map((item, index) => (
              <div className="cfg-list-item" key={item.id}>
                <input
                  type="text"
                  className="pdp-input cfg-list-input"
                  value={expenses[index]}
                  onChange={(e) => updateExpense(index, e.target.value)}
                />
                <button
                  type="button"
                  className="payroll-delete-btn"
                  onClick={() => removeExpense(index)}
                  aria-label="Remove expense"
                >
                  <span className="material-icons-outlined">delete_outline</span>
                </button>
              </div>
            )) : (
              <div className="text-muted">No expense suggestions yet.</div>
            )}
            <button type="button" className="inv-btn-ghost" onClick={addExpense}>
              <span className="material-icons-outlined">add</span> Add Expense
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="cfg-save-btn"
        onClick={handleSave}
        disabled={saving}
      >
        <span className="material-icons-outlined">save</span>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}
