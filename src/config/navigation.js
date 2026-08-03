// navigation icons use material icons (rendered as string names)

import DashboardPage from '../components/features/dashboard/DashboardPage.jsx';
import POSPage from '../components/features/pos/POSPage.jsx';
import CashDrawerPage from '../components/features/cashDrawer/CashDrawerPage.jsx';
import InventoryPage from '../components/features/inventory/InventoryPage.jsx';
import CashManagementPage from '../components/features/cashManagement/CashManagementPage.jsx';
import LogbookPage from '../components/features/logbook/LogbookPage.jsx';
import PautangPage from '../components/features/pautang/PautangPage.jsx';
import CustomersPage from '../components/features/customers/CustomersPage.jsx';
import PayrollPage from '../components/features/payroll/PayrollPage.jsx';
import ReportsPage from '../components/features/reports/ReportsPage.jsx';
import SettingsPage from '../components/features/settings/SettingsPage.jsx';

/**
 * Single source of truth for every top-level page in the app.
 * Sidebar.jsx maps over this to render nav links, and AppRoutes.jsx
 * maps over it to register routes — add a page once, here, and it
 * shows up everywhere it needs to.
 */
export const NAV_ITEMS = [
  { key: 'dashboard', path: '/', label: 'Dashboard', icon: 'dashboard', element: DashboardPage },
  { key: 'reports', path: '/reports', label: 'Reports', icon: 'table_chart', element: ReportsPage },
  { key: 'cash-management', path: '/cash-management', label: 'Cash Management', icon: 'account_balance', element: CashManagementPage },
  { key: 'inventory', path: '/inventory', label: 'Inventory', icon: 'inventory_2', element: InventoryPage },
  { key: 'cash-drawer', path: '/cash-drawer', label: 'Cash Drawer', icon: 'account_balance_wallet', element: CashDrawerPage },
  { key: 'pos', path: '/pos', label: 'Point of Sale', icon: 'shopping_cart', element: POSPage },
  { key: 'logbook', path: '/logbook', label: 'Logbook', icon: 'menu_book', element: LogbookPage },
  { key: 'pautang', path: '/pautang', label: 'Pautang', icon: 'payments', element: PautangPage },
  { key: 'customers', path: '/customers', label: 'Customers', icon: 'people', element: CustomersPage },
  { key: 'payroll', path: '/payroll', label: 'Payroll', icon: 'receipt_long', element: PayrollPage },
  { key: 'settings', path: '/settings', label: 'Settings', icon: 'settings', element: SettingsPage },
];

export function getNavItemByPath(pathname) {
  return NAV_ITEMS.find((item) =>
    item.path === '/' ? pathname === '/' : pathname.startsWith(item.path)
  );
}
