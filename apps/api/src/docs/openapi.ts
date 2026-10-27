const errorResponse = {
  description: 'Error',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
    },
  },
};

const storeParam = {
  name: 'storeId',
  in: 'path',
  required: true,
  schema: { type: 'string', format: 'uuid' },
};

const pageParams = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  {
    name: 'limit',
    in: 'query',
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
  },
];

const ok = (description: string) => ({
  description,
  content: { 'application/json': { schema: { type: 'object', additionalProperties: true } } },
});

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'PulseBoard API',
    version: '1.0.0',
    description:
      'REST API for PulseBoard — real-time sales analytics for small businesses.\n\n' +
      '**Authentication:** send `Authorization: Bearer <accessToken>`. Refresh tokens are stored in an ' +
      'httpOnly cookie (`pb_refresh`) and rotate on every refresh.\n\n' +
      '**Errors:** every failure returns `{ error: { code, message, details?, requestId } }`.\n\n' +
      '**Realtime:** Socket.IO at `/socket.io` — authenticate with `auth.token`, then emit `join-store`.',
    license: { name: 'MIT' },
  },
  servers: [{ url: 'http://localhost:4000', description: 'Local development' }],
  tags: [
    { name: 'Auth' },
    { name: 'Stores' },
    { name: 'Products' },
    { name: 'Inventory' },
    { name: 'Sales' },
    { name: 'Analytics' },
    { name: 'Team' },
    { name: 'Notifications' },
    { name: 'Preferences' },
    { name: 'System' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object', additionalProperties: true },
              requestId: { type: 'string' },
            },
            required: ['code', 'message'],
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          role: {
            type: 'string',
            enum: ['super_admin', 'business_owner', 'manager', 'cashier', 'viewer'],
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          user: { $ref: '#/components/schemas/User' },
          accessToken: { type: 'string' },
          expiresIn: { type: 'integer', example: 900 },
          storeId: { type: 'string', format: 'uuid' },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' },
          sku: { type: 'string' },
          name: { type: 'string' },
          category: { type: 'string', nullable: true },
          price: { type: 'string', example: '12.50' },
          cost: { type: 'string', nullable: true },
          currentStock: { type: 'integer' },
          minStock: { type: 'integer' },
          maxStock: { type: 'integer' },
          unit: { type: 'string' },
          barcode: { type: 'string', nullable: true },
          expiryDate: { type: 'string', format: 'date', nullable: true },
        },
      },
      SaleItemInput: {
        type: 'object',
        required: ['productId', 'quantity'],
        properties: {
          productId: { type: 'string', format: 'uuid' },
          quantity: { type: 'integer', minimum: 1 },
        },
      },
      SaleInput: {
        type: 'object',
        required: ['items', 'paymentMethod'],
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/SaleItemInput' },
            minItems: 1,
          },
          paymentMethod: { type: 'string', enum: ['cash', 'card', 'mobile', 'cheque'] },
          discount: { type: 'number', minimum: 0, default: 0 },
          customerName: { type: 'string' },
          notes: { type: 'string' },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
          hasNext: { type: 'boolean' },
          hasPrevious: { type: 'boolean' },
        },
      },
    },
    responses: { Error: errorResponse },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['System'],
        summary: 'Liveness and database check',
        security: [],
        responses: { '200': ok('Service is healthy') },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create a business owner account and default store',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'firstName', 'lastName'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', minLength: 10 },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  storeName: { type: 'string' },
                  currency: { type: 'string', example: 'EUR' },
                  timezone: { type: 'string', example: 'Europe/Berlin' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Account created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/AuthResponse' } },
                },
              },
            },
          },
          '409': errorResponse,
          '422': errorResponse,
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Sign in with email and password',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                  rememberMe: { type: 'boolean', default: false },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Authenticated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { data: { $ref: '#/components/schemas/AuthResponse' } },
                },
              },
            },
          },
          '401': errorResponse,
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate the refresh token and issue a new access token',
        security: [],
        responses: { '200': ok('New access token'), '401': errorResponse },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Revoke the current refresh token',
        responses: { '200': ok('Logged out') },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Current user, stores and preferences',
        responses: { '200': ok('Profile'), '401': errorResponse },
      },
      patch: {
        tags: ['Auth'],
        summary: 'Update profile',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  phone: { type: 'string' },
                  avatarUrl: { type: 'string', format: 'uri' },
                },
              },
            },
          },
        },
        responses: { '200': ok('Updated profile'), '422': errorResponse },
      },
    },
    '/api/v1/auth/change-password': {
      post: {
        tags: ['Auth'],
        summary: 'Change password (requires current password)',
        responses: { '200': ok('Password updated'), '401': errorResponse },
      },
    },
    '/api/v1/auth/forgot-password': {
      post: {
        tags: ['Auth'],
        summary: 'Request a password reset link',
        security: [],
        responses: { '200': ok('Generic confirmation') },
      },
    },
    '/api/v1/auth/reset-password': {
      post: {
        tags: ['Auth'],
        summary: 'Reset password with a one-time token',
        security: [],
        responses: { '200': ok('Password reset'), '401': errorResponse },
      },
    },
    '/api/v1/stores': {
      get: {
        tags: ['Stores'],
        summary: 'List accessible stores with live metrics',
        parameters: [...pageParams, { name: 'search', in: 'query', schema: { type: 'string' } }],
        responses: { '200': ok('Stores'), '401': errorResponse },
      },
      post: {
        tags: ['Stores'],
        summary: 'Create a store (business owners only)',
        responses: { '201': ok('Store created'), '403': errorResponse },
      },
    },
    '/api/v1/stores/compare': {
      get: {
        tags: ['Stores'],
        summary: 'Compare performance across stores',
        responses: { '200': ok('Comparison'), '401': errorResponse },
      },
    },
    '/api/v1/stores/{storeId}': {
      get: {
        tags: ['Stores'],
        summary: 'Store details, metrics and permissions',
        parameters: [storeParam],
        responses: { '200': ok('Store'), '403': errorResponse, '404': errorResponse },
      },
      patch: {
        tags: ['Stores'],
        summary: 'Update store profile',
        parameters: [storeParam],
        responses: { '200': ok('Updated store'), '403': errorResponse },
      },
      delete: {
        tags: ['Stores'],
        summary: 'Delete a store (owner only)',
        parameters: [storeParam],
        responses: { '200': ok('Store deleted'), '403': errorResponse },
      },
    },
    '/api/v1/stores/{storeId}/products': {
      get: {
        tags: ['Products'],
        summary: 'List products',
        parameters: [
          storeParam,
          ...pageParams,
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'lowStockOnly', in: 'query', schema: { type: 'boolean' } },
          {
            name: 'sortBy',
            in: 'query',
            schema: { type: 'string', enum: ['name', 'price', 'stock', 'createdAt'] },
          },
          { name: 'sortOrder', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
        ],
        responses: { '200': ok('Products'), '403': errorResponse },
      },
      post: {
        tags: ['Products'],
        summary: 'Create a product',
        parameters: [storeParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['sku', 'name', 'price'],
                properties: {
                  sku: { type: 'string' },
                  name: { type: 'string' },
                  category: { type: 'string' },
                  price: { type: 'number' },
                  cost: { type: 'number' },
                  currentStock: { type: 'integer' },
                  minStock: { type: 'integer' },
                  maxStock: { type: 'integer' },
                  unit: { type: 'string' },
                  barcode: { type: 'string' },
                  expiryDate: { type: 'string', format: 'date' },
                },
              },
            },
          },
        },
        responses: { '201': ok('Product created'), '409': errorResponse },
      },
    },
    '/api/v1/stores/{storeId}/products/{productId}': {
      get: {
        tags: ['Products'],
        summary: 'Get a product',
        parameters: [
          storeParam,
          {
            name: 'productId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { '200': ok('Product'), '404': errorResponse },
      },
      patch: {
        tags: ['Products'],
        summary: 'Update a product',
        parameters: [
          storeParam,
          {
            name: 'productId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { '200': ok('Updated product'), '404': errorResponse },
      },
      delete: {
        tags: ['Products'],
        summary: 'Archive a product (soft delete)',
        parameters: [
          storeParam,
          {
            name: 'productId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { '200': ok('Product archived') },
      },
    },
    '/api/v1/stores/{storeId}/inventory/adjust': {
      post: {
        tags: ['Inventory'],
        summary: 'Adjust stock with an audit trail',
        parameters: [storeParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['productId', 'quantityChange', 'reason'],
                properties: {
                  productId: { type: 'string', format: 'uuid' },
                  quantityChange: { type: 'integer', example: -3 },
                  reason: {
                    type: 'string',
                    enum: ['purchase', 'loss', 'damage', 'correction', 'return'],
                  },
                  notes: { type: 'string' },
                },
              },
            },
          },
        },
        responses: { '200': ok('Adjustment recorded'), '400': errorResponse },
      },
    },
    '/api/v1/stores/{storeId}/inventory/low-stock': {
      get: {
        tags: ['Inventory'],
        summary: 'Low stock products',
        parameters: [storeParam],
        responses: { '200': ok('Low stock') },
      },
    },
    '/api/v1/stores/{storeId}/inventory/import': {
      post: {
        tags: ['Inventory'],
        summary: 'Bulk import products from CSV',
        parameters: [storeParam],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: { file: { type: 'string', format: 'binary' } },
              },
            },
          },
        },
        responses: { '200': ok('Import summary'), '400': errorResponse },
      },
    },
    '/api/v1/stores/{storeId}/inventory/export': {
      get: {
        tags: ['Inventory'],
        summary: 'Export products as CSV',
        parameters: [storeParam],
        responses: { '200': { description: 'CSV file' } },
      },
    },
    '/api/v1/stores/{storeId}/sales': {
      get: {
        tags: ['Sales'],
        summary: 'List sales',
        parameters: [
          storeParam,
          ...pageParams,
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
          {
            name: 'paymentMethod',
            in: 'query',
            schema: { type: 'string', enum: ['cash', 'card', 'mobile', 'cheque'] },
          },
          { name: 'search', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': ok('Sales'), '403': errorResponse },
      },
      post: {
        tags: ['Sales'],
        summary: 'Record a sale (prices and totals are computed server-side)',
        parameters: [storeParam],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/SaleInput' } },
          },
        },
        responses: {
          '201': ok('Sale created'),
          '400': errorResponse,
          '409': errorResponse,
        },
      },
    },
    '/api/v1/stores/{storeId}/sales/stats/daily': {
      get: {
        tags: ['Sales'],
        summary: 'Daily revenue series with period comparison',
        parameters: [
          storeParam,
          { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } },
        ],
        responses: { '200': ok('Daily stats') },
      },
    },
    '/api/v1/stores/{storeId}/sales/stats/hourly': {
      get: {
        tags: ['Sales'],
        summary: 'Hourly revenue for a day',
        parameters: [
          storeParam,
          { name: 'date', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { '200': ok('Hourly stats') },
      },
    },
    '/api/v1/stores/{storeId}/analytics/dashboard': {
      get: {
        tags: ['Analytics'],
        summary: 'Complete dashboard payload (cached for 15s)',
        parameters: [
          storeParam,
          { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } },
        ],
        responses: { '200': ok('Dashboard') },
      },
    },
    '/api/v1/stores/{storeId}/analytics/revenue': {
      get: {
        tags: ['Analytics'],
        summary: 'Revenue trend by day, week or month',
        parameters: [
          storeParam,
          {
            name: 'period',
            in: 'query',
            schema: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
          },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { '200': ok('Revenue analytics') },
      },
    },
    '/api/v1/stores/{storeId}/analytics/products': {
      get: {
        tags: ['Analytics'],
        summary: 'Top and bottom products, margins, categories',
        parameters: [
          storeParam,
          { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } },
        ],
        responses: { '200': ok('Product performance') },
      },
    },
    '/api/v1/stores/{storeId}/analytics/customers': {
      get: {
        tags: ['Analytics'],
        summary: 'Customer segments and top customers',
        parameters: [
          storeParam,
          { name: 'days', in: 'query', schema: { type: 'integer', default: 90 } },
        ],
        responses: { '200': ok('Customer analytics') },
      },
    },
    '/api/v1/stores/{storeId}/analytics/peak-hours': {
      get: {
        tags: ['Analytics'],
        summary: 'Hourly and weekday traffic analysis',
        parameters: [
          storeParam,
          { name: 'days', in: 'query', schema: { type: 'integer', default: 30 } },
        ],
        responses: { '200': ok('Peak hours') },
      },
    },
    '/api/v1/stores/{storeId}/analytics/export': {
      post: {
        tags: ['Analytics'],
        summary: 'Export a PDF or CSV report',
        parameters: [storeParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['format'],
                properties: {
                  format: { type: 'string', enum: ['pdf', 'csv'] },
                  type: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Report file' }, '403': errorResponse },
      },
    },
    '/api/v1/stores/{storeId}/team': {
      get: {
        tags: ['Team'],
        summary: 'List team members',
        parameters: [storeParam],
        responses: { '200': ok('Members') },
      },
    },
    '/api/v1/stores/{storeId}/team/invite': {
      post: {
        tags: ['Team'],
        summary: 'Invite a member by email',
        parameters: [storeParam],
        responses: { '201': ok('Invitation created'), '409': errorResponse },
      },
    },
    '/api/v1/stores/{storeId}/team/{userId}/role': {
      put: {
        tags: ['Team'],
        summary: 'Change a member role',
        parameters: [
          storeParam,
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { '200': ok('Role updated'), '403': errorResponse },
      },
    },
    '/api/v1/stores/{storeId}/team/{userId}': {
      delete: {
        tags: ['Team'],
        summary: 'Remove a member',
        parameters: [
          storeParam,
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: { '200': ok('Member removed'), '403': errorResponse },
      },
    },
    '/api/v1/stores/{storeId}/activity-log': {
      get: {
        tags: ['Team'],
        summary: 'Audit trail',
        parameters: [storeParam, ...pageParams],
        responses: { '200': ok('Activity') },
      },
    },
    '/api/v1/invitations/accept': {
      post: {
        tags: ['Team'],
        summary: 'Accept an invitation (public)',
        security: [],
        responses: { '200': ok('Invitation accepted'), '401': errorResponse },
      },
    },
    '/api/v1/notifications': {
      get: {
        tags: ['Notifications'],
        summary: 'List notifications',
        responses: { '200': ok('Notifications') },
      },
    },
    '/api/v1/notifications/read-all': {
      patch: {
        tags: ['Notifications'],
        summary: 'Mark all as read',
        responses: { '200': ok('Updated') },
      },
    },
    '/api/v1/user/preferences': {
      get: {
        tags: ['Preferences'],
        summary: 'Read user preferences',
        responses: { '200': ok('Preferences') },
      },
      put: {
        tags: ['Preferences'],
        summary: 'Update user preferences',
        responses: { '200': ok('Preferences') },
      },
    },
  },
} as const;
