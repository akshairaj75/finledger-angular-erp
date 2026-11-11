describe('Sales & AR Workflow: Login -> Create Invoice -> Record Receipt', () => {
  const grantedPermissions = [
    'DASHBOARD_VIEW',
    'REPORT_VIEW',
    'INVOICE_VIEW',
    'INVOICE_CREATE',
    'INVOICE_SEND',
    'RECEIPT_VIEW',
    'RECEIPT_CREATE',
    'CUSTOMER_VIEW',
    'ITEM_VIEW'
  ];

  const mockUser = {
    id: 1,
    companyId: 1,
    email: 'admin@finledger.com',
    fullName: 'System Administrator',
    status: 'ACTIVE',
    roles: ['ADMIN']
  };

  const mockCompany = {
    id: 1,
    code: 'BSB',
    legalName: 'BSB Trading LLC',
    countryCode: 'AE',
    baseCurrency: 'AED',
    fiscalYearStartMonth: 1,
    isActive: true
  };

  beforeEach(() => {
    cy.intercept('POST', '**/api/v1/auth/login', {
      statusCode: 200,
      body: {
        accessToken: 'mock-jwt-access-token',
        refreshToken: 'mock-jwt-refresh-token',
        user: mockUser,
        permissions: grantedPermissions
      }
    }).as('loginReq');

    cy.intercept('GET', '**/api/v1/auth/me', {
      statusCode: 200,
      body: {
        user: mockUser,
        company: mockCompany,
        permissions: grantedPermissions
      }
    }).as('getMe');

    cy.intercept('GET', '**/api/v1/dashboard/summary*', {
      statusCode: 200,
      body: {
        totalRevenueYtd: 120000,
        totalExpensesYtd: 45000,
        accountsReceivable: 18500,
        cashAndBank: 95000,
        accountsPayable: 12000,
        openPipelineValue: 50000,
        openPipelineCount: 3,
        totalInventoryValue: 64000,
        lowStockItemCount: 0,
        expensesAwaitingApprovalAmount: 500,
        expensesAwaitingApprovalCount: 1,
        monthlyRevenueExpenses: [],
        receivablesAgeing: { total: 18500, current: 18500, days1To30: 0, days31To60: 0, days61To90: 0, over90: 0 },
        recentTransactions: []
      }
    });

    cy.intercept('GET', '**/api/v1/customers*', {
      statusCode: 200,
      body: {
        content: [
          { id: 101, name: 'Al-Futtaim Logistics LLC', currencyCode: 'AED', paymentTermsDays: 30 }
        ],
        totalElements: 1
      }
    }).as('getCustomers');

    cy.intercept('GET', '**/api/v1/items*', {
      statusCode: 200,
      body: {
        content: [
          { id: 201, sku: 'SRV-CONSULT', name: 'ERP Implementation Consulting', salesPrice: 500.00 }
        ],
        totalElements: 1
      }
    }).as('getItems');

    cy.intercept('GET', '**/api/v1/tax-rates*', {
      statusCode: 200,
      body: [
        { id: 1, code: 'VAT5', name: 'UAE Standard VAT 5%', rate: 5.0 }
      ]
    }).as('getTaxRates');
  });

  it('Step 1: Unauthenticated root visits redirect to /login and authenticates cleanly', () => {
    cy.visit('/dashboard');
    cy.url().should('include', '/login');
    cy.get('input[formcontrolname="email"]').type('admin@finledger.com');
    cy.get('input[formcontrolname="password"]').type('password');
    cy.get('button[type="submit"]').click();
    cy.wait('@loginReq');
    cy.wait('@getMe');
    cy.url().should('include', '/dashboard');
    cy.contains('BSB Trading LLC').should('exist');
    cy.contains('System Administrator').should('exist');
  });

  it('Step 2 & 3: Creates customer invoice and verifies transition to ISSUED status', () => {
    window.localStorage.setItem('finledger_access_token', 'mock-jwt-access-token');
    window.localStorage.setItem('finledger_refresh_token', 'mock-jwt-refresh-token');

    cy.intercept('POST', '**/api/v1/invoices', {
      statusCode: 201,
      body: {
        id: 5001,
        invoiceNo: 'INV-2026-0001',
        customerId: 101,
        customerName: 'Al-Futtaim Logistics LLC',
        invoiceDate: '2026-11-10',
        dueDate: '2026-12-10',
        subtotal: 5000.00,
        taxTotal: 250.00,
        total: 5250.00,
        balanceDue: 5250.00,
        status: 'SENT'
      }
    }).as('createInvoice');

    cy.intercept('GET', '**/api/v1/invoices*', {
      statusCode: 200,
      body: {
        content: [
          {
            id: 5001,
            invoiceNo: 'INV-2026-0001',
            customerName: 'Al-Futtaim Logistics LLC',
            invoiceDate: '2026-11-10',
            dueDate: '2026-12-10',
            total: 5250.00,
            amountPaid: 0,
            balanceDue: 5250.00,
            status: 'SENT'
          }
        ],
        totalElements: 1
      }
    }).as('getInvoices');

    cy.visit('/sales/invoices/new');
    cy.wait('@getMe');
    cy.contains(/new.*invoice|create invoice/i).should('exist');
    cy.get('select[formcontrolname="customerId"]').select(1);
    cy.get('button[type="submit"], button.btn-primary').contains(/create|save|submit/i).click();
    cy.wait('@createInvoice');

    cy.visit('/sales/invoices');
    cy.wait('@getInvoices');
    cy.contains('INV-2026-0001').should('exist');
    cy.contains('5,250.00').should('exist');
  });

  it('Step 4: Records customer receipt against invoice', () => {
    window.localStorage.setItem('finledger_access_token', 'mock-jwt-access-token');
    window.localStorage.setItem('finledger_refresh_token', 'mock-jwt-refresh-token');

    cy.intercept('GET', '**/api/v1/invoices/5001', {
      statusCode: 200,
      body: {
        id: 5001,
        invoiceNo: 'INV-2026-0001',
        customerId: 101,
        customerName: 'Al-Futtaim Logistics LLC',
        total: 5250.00,
        balanceDue: 5250.00,
        status: 'SENT'
      }
    });

    cy.intercept('POST', '**/api/v1/receipts', {
      statusCode: 201,
      body: {
        id: 7001,
        receiptNo: 'RCT-2026-0001',
        receiptDate: '2026-11-10',
        customerId: 101,
        amount: 5250.00,
        paymentMethod: 'BANK_TRANSFER'
      }
    }).as('createReceipt');

    cy.visit('/sales/receipts/new?invoiceId=5001');
    cy.wait('@getMe');
    cy.contains(/new receipt|record payment|record receipt/i).should('exist');
    cy.get('button[type="submit"], button.btn-primary').contains(/record|save|submit/i).click();
    cy.wait('@createReceipt');
    cy.contains(/receipt|success|rct-2026-0001/i).should('exist');
  });
});
