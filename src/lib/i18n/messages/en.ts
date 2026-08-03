/**
 * next-intl English message catalog
 * Generated from src/lib/i18n/dictionary.ts — English values
 */
export const enMessages = {
  app: { name: 'Ormenal', tagline: 'Enterprise Resource Planning System' },
  action: {
    save: 'Save', cancel: 'Cancel', delete: 'Delete', edit: 'Edit',
    add: 'Add', create: 'Create', update: 'Update', view: 'View',
    print: 'Print', export: 'Export', search: 'Search', filter: 'Filter',
    confirm: 'Confirm', close: 'Close', back: 'Back', next: 'Next',
    previous: 'Previous', refresh: 'Refresh', more: 'More', actions: 'Actions',
    selectAll: 'Select All', clear: 'Clear', apply: 'Apply',
  },
  status: {
    draft: 'Draft', confirmed: 'Confirmed', delivered: 'Delivered', ordered: 'Ordered',
    received: 'Received', paid: 'Paid', cancelled: 'Cancelled', posted: 'Posted',
    reversed: 'Reversed', completed: 'Completed', pending: 'Pending', approved: 'Approved',
    rejected: 'Rejected', fulfilled: 'Fulfilled', in_transit: 'In Transit',
    open: 'Open', closed: 'Closed', locked: 'Locked', active: 'Active',
    inactive: 'Inactive', present: 'Present', absent: 'Absent', late: 'Late',
    leave: 'Leave', refunded: 'Refunded', in_progress: 'In Progress', planned: 'Planned',
  },
  nav: {
    group: {
      overview: 'Overview', platform: 'System', 'master-data': 'Master Data',
      finance: 'Finance', sales: 'Sales', procurement: 'Procurement',
      inventory: 'Inventory', manufacturing: 'Manufacturing', hr: 'Human Resources',
      reports: 'Reports', pos: 'Point of Sale', branches: 'Branches',
    },
  },
  module: {
    dashboard: 'Dashboard', pos: 'POS', partners: 'Partners',
    products: 'Products', categories: 'Categories', warehouses: 'Warehouses',
    storehouses: 'Storehouses', branches: 'Branches', activities: 'Activities',
    'stock-locations': 'Stock Locations', 'stock-on-hand': 'Stock on Hand',
    deliveries: 'Deliveries',
    'inventory-adjustments': 'Inventory Adjustments', 'stock-moves': 'Stock Moves',
    'stock-takes': 'Stock Takes', 'inventory-transfers': 'Inventory Transfers',
    'inventory-incoming': 'Inventory Incoming', 'inventory-outgoing': 'Inventory Outgoing',
    'inventory-requisitions': 'Inventory Requisitions',
    'sales-quotations': 'Sales Quotations', 'sales-orders': 'Sales Orders',
    'sales-invoices': 'Sales Invoices', 'sales-credit-notes': 'Sales Credit Notes',
    'sales-returns': 'Sales Returns', 'sales-payments': 'Receipts',
    'purchase-requests': 'Purchase Requests', 'purchase-orders': 'Purchase Orders',
    'goods-receipts': 'Goods Receipts', 'purchase-invoices': 'Purchase Invoices',
    'purchase-credit-notes': 'Purchase Credit Notes', 'purchase-returns': 'Purchase Returns',
    'purchase-payments': 'Payments',
    'chart-of-accounts': 'Chart of Accounts', 'journal-entries': 'Journal Entries',
    'fiscal-periods': 'Fiscal Periods', 'cost-centers': 'Cost Centers',
    'analytic-accounts': 'Analytic Accounts', 'closed-periods': 'Closed Periods',
    'bank-accounts': 'Bank Accounts', safes: 'Safes',
    expenses: 'Expenses', revenues: 'Revenues',
    'finance-transfers': 'Transfers', 'finance-requisitions': 'Requisitions',
    'document-templates': 'Document Templates',
    boms: 'Bills of Materials', 'work-centers': 'Work Centers', 'production-orders': 'Production Orders',
    employees: 'Employees', departments: 'Departments', attendance: 'Attendance',
    'leave-requests': 'Leave Requests', 'payroll-runs': 'Payroll Runs',
    reports: 'Reports', users: 'Users', roles: 'Roles',
    settings: 'Settings', 'audit-logs': 'Audit Logs',
    notifications: 'Notifications', profile: 'Profile',
  },
  topbar: {
    searchPlaceholder: 'Search modules, clients, products...',
    quickAdd: 'Quick Add', notifications: 'Notifications',
    profile: 'Profile', settings: 'Settings', logout: 'Sign Out',
    toggleSidebar: 'Toggle Sidebar',
  },
  appearance: {
    theme: {
      label: 'Theme',
      light: 'Light',
      dark: 'Dark',
      system: 'System',
    },
    language: {
      label: 'Language',
      ar: 'Arabic',
      en: 'English',
    },
  },
  misc: {
    all: 'All', none: 'None', yes: 'Yes', no: 'No',
    required: 'Required', optional: 'Optional', from: 'From', to: 'To',
    page: 'Page', of: 'of', records: 'records', total: 'Total',
    confirmDelete: 'Are you sure you want to delete?', viewAll: 'View All',
    lowStock: 'Low Stock', recentOrders: 'Recent Orders',
    topProducts: 'Top Products',
  },
  auth: {
    signIn: 'Sign In', signOut: 'Sign Out',
    username: 'Username', password: 'Password',
    invalidCredentials: 'Invalid username or password',
    sessionExpired: 'Session expired. Please sign in again.',
  },
  empty: {
    noData: 'No data', noResults: 'No matching results',
    addFirst: 'Add your first item to get started',
  },
  loading: 'Loading...',
  error: {
    fetch: 'Failed to load data',
    save: 'Failed to save',
    delete: 'Failed to delete',
  },
  success: {
    saved: 'Saved successfully',
    created: 'Created successfully',
    updated: 'Updated successfully',
    deleted: 'Deleted successfully',
  },
  role: {
    admin: 'Admin', manager: 'Manager', accountant: 'Accountant',
    cashier: 'Cashier', employee: 'Employee', viewer: 'Viewer',
    developer: 'Developer', owner: 'Owner',
  },
} as const

export type EnMessages = typeof enMessages
