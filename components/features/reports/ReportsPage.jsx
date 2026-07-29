import { useEffect, useMemo, useState } from 'react';
import DataTable from '../../../src/scripts/DataTable.jsx';
import SearchInput from '../../../src/scripts/Searchinput.jsx';
import { getReportsData } from '../../../src/api/reports';
import './reports.css';

const TABS = [
  { key: 'sales', label: 'Products Sold' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'pautang', label: 'Pautang' },
  { key: 'collections', label: 'Collections' },
  { key: 'advances', label: 'Advances' },
  { key: 'cashdrawer', label: 'Cash Drawer' },
  { key: 'borrowed', label: 'Borrowed' },
];

const DATE_FILTERS = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial' },
  { value: 'utang', label: 'Utang' },
  { value: 'void', label: 'Void' },
];

function formatPeso(amount) {
  return '₱' + Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(timeStr) {
  if (!timeStr) return '';
  const match = String(timeStr).match(/(\d{1,2}):(\d{2})/);
  if (match) return `${match[1].padStart(2, '0')}:${match[2]}`;
  const d = new Date(timeStr);
  if (!Number.isNaN(d.getTime())) return d.toTimeString().slice(0, 5);
  return timeStr;
}

function normalizeSales(rows = []) {
  return rows.map((r) => ({
    orderId: r.order_id || r.orderId || r.id || '',
    date: r.date || '',
    time: r.time || '',
    customer: r.customer || r.customer_name || r.customerName || '',
    slimPoly: r.slim_poly || r.slimPoly || r.slimpoly || '',
    product: r.product || '',
    qty: Number(r.qty || r.quantity || 0),
    pointPerson: r.point_person || r.pointPerson || r.pointPersonName || '',
    total: Number(r.total_amount || r.total || 0),
    amountPaid: Number(r.amount_paid || r.amountPaid || r.amount || 0),
    status: String(r.status || '').trim(),
    notes: r.notes || '',
  }));
}

function normalizeExpenses(rows = []) {
  return rows.map((r) => ({
    id: r.id || r.expense_id || '',
    date: r.date || '',
    time: r.time || '',
    description: r.description || '',
    amount: Number(r.amount || 0),
  }));
}

function normalizePautang(rows = []) {
  return rows.map((r) => ({
    orderId: r.order_id || r.orderId || r.id || '',
    date: r.date || '',
    time: r.time || '',
    customerName: r.customer_name || r.customerName || r.customer || '',
    pointPerson: r.point_person || r.pointPerson || '',
    amount: Number(r.amount || 0),
    status: String(r.status || '').trim(),
  }));
}

function normalizeCollections(rows = []) {
  return rows.map((r) => ({
    id: r.id || r.collection_id || '',
    date: r.date || '',
    time: r.time || '',
    orderId: r.order_id || r.orderId || '',
    description: r.description || '',
    pointPerson: r.point_person || r.pointPerson || '',
    amount: Number(r.amount || 0),
  }));
}

function normalizeAdvances(rows = []) {
  return rows.map((r) => {
    const description = String(r.description || '');
    const staff = description.replace(/^advance\s*[-–]\s*/i, '').trim() || r.point_person || r.pointPerson || 'Staff';
    return {
      id: r.id || r.advance_id || '',
      date: r.date || '',
      time: r.time || '',
      staff,
      amount: Number(r.amount || 0),
    };
  });
}

function normalizeBorrowed(customers = []) {
  return customers
    .map((r) => ({
      customerId: r.customer_id || r.customerId || r.id || '',
      customerName: r.customer_name || r.customerName || r.name || '',
      gallon: Number(r.gallon || 0),
      dispenser: Number(r.dispenser || 0),
      date: r.last_borrow_date || r.lastBorrowDate || r.date || '',
      time: r.last_borrow_time || r.lastBorrowTime || r.time || '',
    }))
    .filter((r) => r.gallon > 0 || r.dispenser > 0);
}

function normalizeCashDrawer(shifts = [], dayReport = []) {
  const reportMap = {};
  const idKeys = ['shiftId', 'shift_id', 'shiftid', 'id'];

  dayReport.forEach((entry) => {
    const key = idKeys.map((k) => entry[k]).find((value) => value !== undefined && value !== null && String(value) !== '');
    if (key !== undefined) {
      reportMap[String(key)] = entry;
    }
  });

  return shifts.map((shift) => {
    const key =
      String(shift.shiftId || shift.shift_id || shift.shiftid || shift.id || '');
    const details = reportMap[key] || {};
    return {
      shiftId: shift.shiftId || shift.shift_id || shift.shiftid || shift.id || '',
      date: shift.date || '',
      time: shift.time || '',
      status: shift.status || '',
      dayReport: details,
    };
  });
}

function titleCase(key) {
  return key
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function inRange(dateStr, dateFilter, from, to) {
  if (!dateStr) return false;
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (dateFilter === 'today') return normalized.getTime() === today.getTime();
  if (dateFilter === 'week') {
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 6);
    return normalized >= weekAgo && normalized <= today;
  }
  if (dateFilter === 'month') {
    return normalized.getMonth() === today.getMonth() && normalized.getFullYear() === today.getFullYear();
  }
  if (dateFilter === 'custom' && from && to) {
    const start = new Date(from);
    const end = new Date(to);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return true;
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return normalized >= start && normalized <= end;
  }
  return true;
}

function rowMatchesSearch(row, query) {
  if (!query) return true;
  const text = Object.values(row)
    .filter((value) => value !== undefined && value !== null)
    .join(' ')
    .toLowerCase();
  return text.includes(query.toLowerCase());
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [activeTab, setActiveTab] = useState('sales');
  const [dateFilter, setDateFilter] = useState('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');
  const [pointPerson, setPointPerson] = useState('');
  const [product, setProduct] = useState('');
  const [status, setStatus] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState('asc');

  function handleSort(colKey) {
    if (sortCol === colKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(colKey);
      setSortDir('asc');
    }
  }

  useEffect(() => {
    let mounted = true;
    getReportsData()
      .then((result) => {
        if (!mounted) return;
        setData(result);
        setError('');
      })
      .catch((err) => {
        console.error(err);
        if (!mounted) return;
        setError('Unable to load reports data.');
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const normalized = useMemo(() => {
    if (!data) return {};
    return {
      sales: normalizeSales(data.sales),
      expenses: normalizeExpenses(data.expenses),
      pautang: normalizePautang(data.pautang),
      collections: normalizeCollections(data.collections),
      advances: normalizeAdvances(data.advances),
      cashdrawer: normalizeCashDrawer(data.shifts, data.dayReport),
      borrowed: normalizeBorrowed(data.customers),
    };
  }, [data]);

  const pointPersonOptions = useMemo(() => {
    const list = new Set((normalized.sales || []).map((row) => row.pointPerson || '').filter(Boolean));
    return Array.from(list).sort();
  }, [normalized.sales]);

  const productOptions = useMemo(() => {
    const list = new Set((normalized.sales || []).map((row) => row.product || '').filter(Boolean));
    return Array.from(list).sort();
  }, [normalized.sales]);

  const filteredRows = useMemo(() => {
    const rows = normalized[activeTab] || [];

    return rows
      .filter((row) => {
        if (activeTab !== 'cashdrawer') {
          if (!inRange(row.date, dateFilter, customFrom, customTo)) return false;
        }
        if (search && !rowMatchesSearch(row, search)) return false;
        if (activeTab === 'sales') {
          if (pointPerson && row.pointPerson.toLowerCase() !== pointPerson.toLowerCase()) return false;
          if (product && row.product.toLowerCase() !== product.toLowerCase()) return false;
          if (status && row.status.toLowerCase() !== status.toLowerCase()) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortCol) {
          const va = a[sortCol];
          const vb = b[sortCol];
          let cmp;
          if (typeof va === 'number' && typeof vb === 'number') {
            cmp = va - vb;
          } else {
            cmp = String(va ?? '').localeCompare(String(vb ?? ''), undefined, { numeric: true });
          }
          return sortDir === 'asc' ? cmp : -cmp;
        }
        const dateA = new Date(a.date || '');
        const dateB = new Date(b.date || '');
        if (!Number.isNaN(dateA) && !Number.isNaN(dateB)) return dateB - dateA;
        return 0;
      });
  }, [activeTab, normalized, dateFilter, customFrom, customTo, search, pointPerson, product, status, sortCol, sortDir]);

  const columns = useMemo(() => {
    switch (activeTab) {
      case 'sales':
        return [
          { key: 'orderId', label: 'Order ID', sortable: true, sortProps: { 'data-col': 'orderid', 'data-table': 'sales', style: { cursor: 'pointer', userSelect: 'none', color: 'var(--border)', fontSize: '13px' } } },
          { key: 'date', label: 'Date', sortable: true, sortProps: { 'data-col': 'date', 'data-table': 'sales', style: { cursor: 'pointer', userSelect: 'none', color: 'var(--border)', fontSize: '13px' } } },
          { key: 'time', label: 'Time', render: (row) => formatTime(row.time), sortable: true, sortProps: { 'data-col': 'time', 'data-table': 'sales', style: { cursor: 'pointer', userSelect: 'none', color: 'var(--border)', fontSize: '13px' } } },
          { key: 'customer', label: 'Customer', sortable: true, sortProps: { 'data-col': 'customer', 'data-table': 'sales', style: { cursor: 'pointer', userSelect: 'none', color: 'var(--border)', fontSize: '13px' } } },
          { key: 'slimPoly', label: 'Slim/Poly', sortable: true, sortProps: { 'data-col': 'slimpoly', 'data-table': 'sales', style: { cursor: 'pointer', userSelect: 'none', color: 'var(--border)', fontSize: '13px' } } },
          { key: 'product', label: 'Product', sortable: true, sortProps: { 'data-col': 'product', 'data-table': 'sales', style: { cursor: 'pointer', userSelect: 'none', color: 'var(--border)', fontSize: '13px' } } },
          { key: 'qty', label: 'Qty', align: 'center', sortable: true, sortProps: { 'data-col': 'qty', 'data-table': 'sales', style: { cursor: 'pointer', userSelect: 'none', color: 'var(--border)', fontSize: '13px' } } },
          { key: 'pointPerson', label: 'Point Person', sortable: true, sortProps: { 'data-col': 'pointperson', 'data-table': 'sales', style: { cursor: 'pointer', userSelect: 'none', color: 'var(--border)', fontSize: '13px' } } },
          { key: 'total', label: 'Total', align: 'right', render: (row) => formatPeso(row.total), sortable: true, sortProps: { 'data-col': 'total', 'data-table': 'sales', style: { cursor: 'pointer', userSelect: 'none', color: 'var(--border)', fontSize: '13px' } } },
          { key: 'amountPaid', label: 'Paid', align: 'right', render: (row) => formatPeso(row.amountPaid), sortable: true, sortProps: { 'data-col': 'amountpaid', 'data-table': 'sales', style: { cursor: 'pointer', userSelect: 'none', color: 'var(--border)', fontSize: '13px' } } },
          { key: 'status', label: 'Status', sortable: true, sortProps: { 'data-col': 'status', 'data-table': 'sales', style: { cursor: 'pointer', userSelect: 'none', color: 'var(--border)', fontSize: '13px' } } },
          { key: 'notes', label: 'Notes', sortable: true, sortProps: { 'data-col': 'notes', 'data-table': 'sales', style: { cursor: 'pointer', userSelect: 'none', color: 'var(--border)', fontSize: '13px' } } },
        ];
      case 'expenses':
        return [
          { key: 'id', label: 'ID' },
          { key: 'date', label: 'Date' },
          { key: 'time', label: 'Time', render: (row) => formatTime(row.time) },
          { key: 'description', label: 'Description' },
          { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatPeso(row.amount) },
        ];
      case 'pautang':
        return [
          { key: 'orderId', label: 'Order ID' },
          { key: 'date', label: 'Date' },
          { key: 'time', label: 'Time', render: (row) => formatTime(row.time) },
          { key: 'customerName', label: 'Customer' },
          { key: 'pointPerson', label: 'Point Person' },
          { key: 'amount', label: 'Balance', align: 'right', render: (row) => formatPeso(row.amount) },
          { key: 'status', label: 'Status' },
        ];
      case 'collections':
        return [
          { key: 'id', label: 'ID' },
          { key: 'date', label: 'Date' },
          { key: 'time', label: 'Time', render: (row) => formatTime(row.time) },
          { key: 'orderId', label: 'Order ID' },
          { key: 'description', label: 'Description' },
          { key: 'pointPerson', label: 'Point Person' },
          { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatPeso(row.amount) },
        ];
      case 'advances':
        return [
          { key: 'id', label: 'ID' },
          { key: 'date', label: 'Date' },
          { key: 'time', label: 'Time', render: (row) => formatTime(row.time) },
          { key: 'staff', label: 'Staff' },
          { key: 'amount', label: 'Amount', align: 'right', render: (row) => formatPeso(row.amount) },
        ];
      case 'cashdrawer': {
        const base = [
          { key: 'shiftId', label: 'Shift ID' },
          { key: 'date', label: 'Date' },
          { key: 'time', label: 'Time', render: (row) => formatTime(row.time) },
          { key: 'status', label: 'Status' },
        ];
        const extraKeys = [];
        if (data?.dayReport?.length) {
          Object.keys(data.dayReport[0] || {}).forEach((key) => {
            const normalizedKey = key.toString();
            if (!['shiftId', 'shift_id', 'shiftid', 'id'].includes(normalizedKey)) {
              extraKeys.push(normalizedKey);
            }
          });
        }
        return base.concat(
          extraKeys.map((key) => ({
            key,
            label: titleCase(key),
            align: 'right',
            render: (row) => {
              const value = row.dayReport?.[key];
              if (value === undefined || value === null || value === '') return '--';
              if (typeof value === 'number') return formatPeso(value);
              if (!Number.isNaN(Number(value)) && value !== '') return formatPeso(Number(value));
              return String(value);
            },
          }))
        );
      }
      case 'borrowed':
        return [
          { key: 'customerId', label: 'Customer ID' },
          { key: 'customerName', label: 'Customer Name' },
          { key: 'date', label: 'Date' },
          { key: 'time', label: 'Time', render: (row) => formatTime(row.time) },
          { key: 'gallon', label: 'Gallons', align: 'center' },
          { key: 'dispenser', label: 'Dispensers', align: 'center' },
        ];
      default:
        return [];
    }
  }, [activeTab, data?.dayReport]);

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFilename, setExportFilename] = useState('');
  const [exportPreset, setExportPreset] = useState('month');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
    setSortCol(null);
    setSortDir('asc');
  }, [activeTab, dateFilter, search, pointPerson, product, status]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  useEffect(() => {
    if (currentPage > pageCount) {
      setCurrentPage(pageCount);
    }
  }, [currentPage, pageCount]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const footerData = useMemo(() => {
    if (!filteredRows.length) return null;
    switch (activeTab) {
      case 'sales':
        return {
          label: 'Total',
          total: formatPeso(filteredRows.reduce((sum, row) => sum + row.total, 0)),
          amountPaid: formatPeso(filteredRows.reduce((sum, row) => sum + row.amountPaid, 0)),
        };
      case 'expenses':
        return { label: 'Total', amount: formatPeso(filteredRows.reduce((sum, row) => sum + row.amount, 0)) };
      case 'pautang':
      case 'collections':
      case 'advances':
        return { label: 'Total', amount: formatPeso(filteredRows.reduce((sum, row) => sum + row.amount, 0)) };
      default:
        return null;
    }
  }, [activeTab, filteredRows]);

  return (
    <div className="reports-page space-y-6">
      <div className="reports-tabs-bar">
        <div className="reports-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`reports-tab ${activeTab === tab.key ? 'active' : ''}`}
              data-tab={tab.key}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="btn-export-report"
          id="exportReportBtn"
          onClick={() => setExportModalOpen(true)}
        >
          <span className="material-icons-outlined">table_chart</span>
          Export to Sheets
        </button>
      </div>

      <div className="reports-global-filter" style={{ position: 'relative', zIndex: 60, overflow: 'visible' }}>
        <div className="report-filter-bar" id="rfbar-global">
          <span
            style={{ fontSize: '13px', fontWeight: 600, color: 'var(--muted-fg)', whiteSpace: 'nowrap' }}
          >
            Date Range:
          </span>
          <select
            className="filter-person-select rf-date"
            id="rGlobalDate"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
          >
            {DATE_FILTERS.map((option) => (
              <option key={option.key} value={option.key}>{option.label}</option>
            ))}
          </select>

          <div
            className="rf-custom-dates"
            id="rfc-global"
            style={{ display: dateFilter === 'custom' ? 'flex' : 'none' }}
          >
            <input
              type="date"
              className="pdp-input rfc-from"
              id="rGlobalFrom"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
              style={{ width: '140px' }}
              placeholder="From"
            />
            <span style={{ color: 'var(--muted-fg)', fontSize: '13px' }}>to</span>
            <input
              type="date"
              className="pdp-input rfc-to"
              id="rGlobalTo"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
              style={{ width: '140px' }}
              placeholder="To"
            />
          </div>
        </div>
      </div>

      {exportModalOpen && (
        <div className="pay-modal-overlay" id="exportModalOverlay">
          <div className="pay-modal">
            <div className="pay-modal-header">
              <div className="pay-modal-title">
                <span className="material-icons-outlined">table_chart</span>
                Export to Google Sheets
              </div>
              <button className="pdp-close-btn" id="exportModalClose" onClick={() => setExportModalOpen(false)}>
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
            <div className="pay-modal-body">
              <div className="pay-modal-info">
                <div>
                  Exports: <strong>Sales, Pautang, CashDrawer, Shift</strong> filtered by date.
                  <br />Always full export: <strong>Customers, Payroll, DayReport, Products, Staff, Config</strong>.
                </div>
              </div>

              <div className="pdp-field">
                <label className="pdp-label">Spreadsheet Name</label>
                <input
                  type="text"
                  className="pdp-input"
                  id="exportFilename"
                  value={exportFilename}
                  onChange={(event) => setExportFilename(event.target.value)}
                  placeholder="e.g. AquaBreeze_March2025"
                />
                <div className="pdp-help-text">
                  Leave blank to use the default name based on date range.
                </div>
              </div>

              <div className="pdp-field">
                <label className="pdp-label">Date Range</label>
                <div className="export-date-presets">
                  {DATE_FILTERS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`export-preset ${exportPreset === option.key ? 'active' : ''}`}
                      onClick={() => setExportPreset(option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {exportPreset === 'custom' && (
                <div id="exportCustomDates" className="filter-custom-dates">
                  <div className="filter-date-group">
                    <label className="filter-date-label">From</label>
                    <input type="date" className="filter-date-input" id="exportDateFrom" />
                  </div>
                  <span className="filter-date-sep" />
                  <div className="filter-date-group">
                    <label className="filter-date-label">To</label>
                    <input type="date" className="filter-date-input" id="exportDateTo" />
                  </div>
                </div>
              )}

              <div id="exportStatus" style={{ display: 'none' }} className="pdp-status-pill status-utang">
                <span className="material-icons-outlined">hourglass_empty</span>
                <span id="exportStatusText">Preparing export...</span>
              </div>

              <button className="btn-primary" id="exportConfirmBtn" type="button">
                <span className="material-icons-outlined">open_in_new</span>
                Create Spreadsheet
              </button>
            </div>
          </div>
        </div>
      )}

      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <div key={tab.key} className={`reports-panel${isActive ? ' active' : ''}`} id={`rtab-${tab.key}`} style={{ display: isActive ? 'block' : 'none' }}>
            <div className="report-toolbar" style={{ position: 'relative', zIndex: 50, overflow: 'visible' }}>
              <SearchInput
                id={`rSearch-${tab.key}`}
                inputClassName="search-input"
                placeholder={
                  tab.key === 'expenses'
                    ? 'Search expenses...'
                    : tab.key === 'pautang'
                    ? 'Search pautang...'
                    : tab.key === 'collections'
                    ? 'Search collections...'
                    : tab.key === 'advances'
                    ? 'Search advances...'
                    : tab.key === 'cashdrawer'
                    ? 'Search shifts...'
                    : tab.key === 'borrowed'
                    ? 'Search customer...'
                    : 'Search order, date, customer, point person...'
                }
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="flex-1 min-w-[240px]"
              />
              {tab.key === 'sales' && (
                <>
                  <select className="filter-person-select" id="rFilter-pp" value={pointPerson} onChange={(event) => setPointPerson(event.target.value)}>
                    <option value="">All Point Persons</option>
                    {pointPersonOptions.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                  <select className="filter-person-select" id="rFilter-product" value={product} onChange={(event) => setProduct(event.target.value)}>
                    <option value="">All Products</option>
                    {productOptions.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                  <select className="filter-person-select" id="rFilter-status" value={status} onChange={(event) => setStatus(event.target.value)}>
                    {STATUS_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </>
              )}
            </div>

            <div className="card">
              <div className="card-body" style={{ overflowX: 'auto' }}>
              <DataTable
                  id={`rtable-${tab.key}`}
                  tableClassName="data-table"
                  columns={columns}
                  rows={paginatedRows}
                  footerData={footerData}
                  emptyLabel="No records found"
                  sortCol={sortCol}
                  sortDir={sortDir}
                  onSort={handleSort}
                />
              </div>
            </div>

            <div id={`pg-rpt-${tab.key}`} className="pagination-bar">
              <div className="pagination-info">
                Showing {filteredRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}–{Math.min(filteredRows.length, currentPage * pageSize)} of {filteredRows.length} results
              </div>
              <div className="pagination-right">
                <select
                  className="pg-size-select"
                  id={`pg-rpt-${tab.key}-size`}
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                >
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>{size} / page</option>
                  ))}
                </select>
                <button
                  type="button"
                  className="pg-nav-btn"
                  id={`pg-rpt-${tab.key}-prev`}
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <span className="material-icons-outlined">chevron_left</span>
                </button>
                <div className="pg-page-input-wrap">
                  <input
                    type="number"
                    className="pg-page-input"
                    id={`pg-rpt-${tab.key}-input`}
                    value={currentPage}
                    min={1}
                    max={pageCount}
                    onChange={(event) => setCurrentPage(Math.min(pageCount, Math.max(1, Number(event.target.value))))}
                  />
                  <span className="pg-total-pages">of {pageCount}</span>
                </div>
                <button
                  type="button"
                  className="pg-nav-btn"
                  id={`pg-rpt-${tab.key}-next`}
                  onClick={() => setCurrentPage((prev) => Math.min(pageCount, prev + 1))}
                  disabled={currentPage === pageCount}
                >
                  <span className="material-icons-outlined">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
