import { formatPeso } from '../../../utils/format.js';

export default function CustomerTableRow({
  customer,
  deliveryBoys,
  massEditMode,
  selected,
  onSelect,
  onInlinePPChange,
  onEdit,
  onOverrideView,
  onBorrow,
  onOrders,
  onDelete,
  inlineSaving,
}) {
  const hasBorrow = customer.gallon > 0 || customer.dispenser > 0;
  const canDelete = !hasBorrow && customer.utang <= 0;

  return (
    <tr
      id={`crow-${customer.id}`}
      data-id={customer.id}
      data-name={customer.name.toLowerCase()}
      data-location={(customer.location || '').toLowerCase()}
      data-pointperson={(customer.pointPerson || '').toLowerCase()}
      data-pointpersonraw={customer.pointPerson || ''}
      data-gallon={customer.gallon}
      data-dispenser={customer.dispenser}
      data-utang={customer.utang}
    >
      <td className="checkbox-cell" style={{ display: massEditMode ? '' : 'none' }}>
        <input
          type="checkbox"
          className="row-checkbox"
          checked={selected}
          onChange={(e) => onSelect(customer.id, e.target.checked)}
        />
      </td>
      <td className="text-bold">
        {customer.name}
        {customer.overrideOn && (
          <span className="override-badge" title="Custom pricing active">₱</span>
        )}
      </td>
      <td>{customer.location || '--'}</td>
      <td>
        <select
          className="inline-pp-select"
          value={customer.pointPerson || ''}
          disabled={inlineSaving === customer.id}
          onChange={(e) => onInlinePPChange(customer, e.target.value, e.target)}
        >
          <option value="">--</option>
          {deliveryBoys.map((s) => (
            <option key={s.id} value={s.name}>{s.name}</option>
          ))}
        </select>
      </td>
      <td>
        {customer.gallon > 0 ? (
          <span className="borrow-badge borrow-badge-gallon">
            <span className="material-icons-outlined">water_drop</span>
            {customer.gallon}
          </span>
        ) : (
          <span style={{ color: 'hsl(var(--border))' }}>--</span>
        )}
      </td>
      <td>
        {customer.dispenser > 0 ? (
          <span className="borrow-badge borrow-badge-dispenser">
            <span className="material-icons-outlined">inventory_2</span>
            {customer.dispenser}
          </span>
        ) : (
          <span style={{ color: 'hsl(var(--border))' }}>--</span>
        )}
      </td>
      <td>
        {customer.utang > 0 ? (
          <span className="badge badge-danger">{formatPeso(customer.utang)}</span>
        ) : (
          <span className="badge badge-success">None</span>
        )}
      </td>
      <td>
        {customer.isActive ? (
          <span className="status-badge-active">
            <span className="material-icons-outlined" style={{ fontSize: 13 }}>check_circle</span>Active
          </span>
        ) : (
          <span className="status-badge-inactive">
            <span className="material-icons-outlined" style={{ fontSize: 13 }}>pause_circle</span>Inactive
          </span>
        )}
      </td>
      <td>
        <div className="payroll-actions">
          <button type="button" className="payroll-edit-btn customer-edit-btn" onClick={() => onEdit(customer)} title="Edit">
            <span className="material-icons-outlined">edit</span>
          </button>
          {customer.overrideOn && (
            <button type="button" className="customer-override-btn" onClick={() => onOverrideView(customer)} title="View/edit override prices">
              <span className="material-icons-outlined">price_change</span>
            </button>
          )}
          {hasBorrow && (
            <button type="button" className="customer-borrow-btn" onClick={() => onBorrow(customer)} title="View borrowed items">
              <span className="material-icons-outlined">swap_horiz</span>
            </button>
          )}
          {customer.utang > 0 && (
            <button type="button" className="customer-balance-btn" onClick={() => onOrders(customer)} title="Outstanding orders">
              <span className="material-icons-outlined">receipt_long</span>
            </button>
          )}
          {canDelete && (
            <button type="button" className="payroll-delete-btn customer-delete-btn" onClick={() => onDelete(customer)} title="Delete">
              <span className="material-icons-outlined">delete_outline</span>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
