# Orders and Payments API Reference

This document provides detailed information about the Orders and Payments API endpoints available in the Deploy Hub platform.

## Authentication

All API requests require authentication using a Firebase JWT token. Include the token in the Authorization header as follows:

```
Authorization: Bearer YOUR_TOKEN
```

## Order Endpoints

### Create Order

Creates a new order for a license purchase.

**URL:** `POST /orders`

**Auth Required:** Yes

**Request Body:**

```json
{
  "licenseId": "uuid-of-license-to-purchase",
  "currency": "USD",
  "notes": "Enterprise license purchase for production use"
}
```

**Parameters:**

| Name      | Type   | Required | Description                                          |
| --------- | ------ | -------- | ---------------------------------------------------- |
| licenseId | string | Yes      | The UUID of the license option to purchase           |
| currency  | string | No       | Currency for the payment (USD, EUR). Defaults to USD |
| notes     | string | No       | Additional notes for the order                       |

**Response:**

```json
{
  "id": "order-uuid",
  "userId": "user-uuid",
  "licenseId": "license-uuid",
  "amount": 99.99,
  "currency": "USD",
  "status": "PENDING",
  "referenceNumber": "ORD-12345",
  "notes": "Enterprise license purchase for production use",
  "createdAt": "2025-04-23T10:30:00Z",
  "updatedAt": "2025-04-23T10:30:00Z",
  "license": {
    "id": "license-uuid",
    "name": "Enterprise License",
    "description": "Full access to all features",
    "price": 99.99,
    "currency": "USD",
    "deploymentLimit": 10,
    "duration": 365,
    "features": ["Premium Support", "CI/CD Integration", "Custom Domain"]
  }
}
```

**Status Codes:**

- 201 - Created: Order successfully created
- 400 - Bad Request: Invalid input parameters
- 401 - Unauthorized: Invalid or missing authentication token
- 404 - Not Found: License option not found

### Get User Orders

Retrieves all orders for the current user with optional filtering.

**URL:** `GET /orders`

**Auth Required:** Yes

**Query Parameters:**

| Name      | Type    | Required | Description                                                              |
| --------- | ------- | -------- | ------------------------------------------------------------------------ |
| page      | number  | No       | Page number for pagination (default: 1)                                  |
| limit     | number  | No       | Number of items per page (default: 10, max: 100)                         |
| status    | string  | No       | Filter by order status (PENDING, COMPLETED, CANCELLED, REFUNDED, FAILED) |
| licenseId | string  | No       | Filter by license ID                                                     |
| currency  | string  | No       | Filter by currency                                                       |
| isActive  | boolean | No       | Filter by active status                                                  |
| search    | string  | No       | Search term for filtering by license name or reference number            |

**Response:**

```json
{
  "items": [
    {
      "id": "order-uuid-1",
      "userId": "user-uuid",
      "licenseId": "license-uuid",
      "amount": 99.99,
      "currency": "USD",
      "status": "PENDING",
      "referenceNumber": "ORD-12345",
      "notes": "Enterprise license purchase",
      "createdAt": "2025-04-23T10:30:00Z",
      "updatedAt": "2025-04-23T10:30:00Z",
      "license": {
        "id": "license-uuid",
        "name": "Enterprise License",
        "description": "Full access to all features",
        "price": 99.99,
        "currency": "USD"
      }
    }
    // Additional orders...
  ],
  "meta": {
    "totalItems": 25,
    "itemCount": 10,
    "itemsPerPage": 10,
    "totalPages": 3,
    "currentPage": 1
  },
  "links": {
    "first": "/orders?page=1",
    "previous": "",
    "next": "/orders?page=2",
    "last": "/orders?page=3"
  }
}
```

**Status Codes:**

- 200 - OK: Orders successfully retrieved
- 401 - Unauthorized: Invalid or missing authentication token

### Get Order By ID

Retrieves a specific order by its ID.

**URL:** `GET /orders/:id`

**Auth Required:** Yes

**URL Parameters:**

| Name | Type   | Required | Description                       |
| ---- | ------ | -------- | --------------------------------- |
| id   | string | Yes      | The UUID of the order to retrieve |

**Response:**

```json
{
  "id": "order-uuid",
  "userId": "user-uuid",
  "licenseId": "license-uuid",
  "amount": 99.99,
  "currency": "USD",
  "status": "PENDING",
  "referenceNumber": "ORD-12345",
  "notes": "Enterprise license purchase",
  "createdAt": "2025-04-23T10:30:00Z",
  "updatedAt": "2025-04-23T10:30:00Z",
  "completedAt": null,
  "isActive": false,
  "expiresAt": null,
  "license": {
    "id": "license-uuid",
    "name": "Enterprise License",
    "description": "Full access to all features",
    "price": 99.99,
    "currency": "USD",
    "deploymentLimit": 10,
    "duration": 365,
    "features": ["Premium Support", "CI/CD Integration", "Custom Domain"]
  },
  "payments": [
    {
      "id": "payment-uuid",
      "orderId": "order-uuid",
      "amount": 99.99,
      "currency": "USD",
      "status": "PENDING",
      "paymentMethod": "CREDIT_CARD",
      "transactionId": "tx_123456789",
      "createdAt": "2025-04-23T10:35:00Z",
      "updatedAt": "2025-04-23T10:35:00Z",
      "processedAt": null
    }
  ]
}
```

**Status Codes:**

- 200 - OK: Order successfully retrieved
- 401 - Unauthorized: Invalid or missing authentication token
- 403 - Forbidden: Attempting to access another user's order
- 404 - Not Found: Order not found

### Admin - Get All Orders (Admin Only)

Retrieves all orders in the system with optional filtering (admin only).

**URL:** `GET /orders/admin`

**Auth Required:** Yes (Admin role)

**Query Parameters:**

| Name      | Type    | Required | Description                                                                |
| --------- | ------- | -------- | -------------------------------------------------------------------------- |
| page      | number  | No       | Page number for pagination (default: 1)                                    |
| limit     | number  | No       | Number of items per page (default: 10, max: 100)                           |
| status    | string  | No       | Filter by order status (PENDING, COMPLETED, CANCELLED, REFUNDED, FAILED)   |
| licenseId | string  | No       | Filter by license ID                                                       |
| currency  | string  | No       | Filter by currency                                                         |
| isActive  | boolean | No       | Filter by active status                                                    |
| search    | string  | No       | Search term for filtering by license name, reference number, or user email |

**Response:**

```json
{
  "items": [
    {
      "id": "order-uuid-1",
      "userId": "user-uuid-1",
      "licenseId": "license-uuid",
      "amount": 99.99,
      "currency": "USD",
      "status": "COMPLETED",
      "referenceNumber": "ORD-12345",
      "notes": "Enterprise license purchase",
      "createdAt": "2025-04-23T10:30:00Z",
      "updatedAt": "2025-04-23T10:40:00Z",
      "completedAt": "2025-04-23T10:40:00Z",
      "isActive": true,
      "expiresAt": "2026-04-23T10:40:00Z",
      "license": {
        "id": "license-uuid",
        "name": "Enterprise License"
      },
      "user": {
        "id": "user-uuid-1",
        "email": "user@example.com",
        "firstName": "John",
        "lastName": "Doe"
      }
    }
    // Additional orders...
  ],
  "meta": {
    "totalItems": 120,
    "itemCount": 10,
    "itemsPerPage": 10,
    "totalPages": 12,
    "currentPage": 1
  },
  "links": {
    "first": "/orders/admin?page=1",
    "previous": "",
    "next": "/orders/admin?page=2",
    "last": "/orders/admin?page=12"
  }
}
```

**Status Codes:**

- 200 - OK: Orders successfully retrieved
- 401 - Unauthorized: Invalid or missing authentication token
- 403 - Forbidden: User does not have admin privileges

### Admin - Get Order By ID (Admin Only)

Retrieves any order by ID (admin only).

**URL:** `GET /orders/admin/:id`

**Auth Required:** Yes (Admin role)

**URL Parameters:**

| Name | Type   | Required | Description                       |
| ---- | ------ | -------- | --------------------------------- |
| id   | string | Yes      | The UUID of the order to retrieve |

**Response:** Same as "Get Order By ID" but can access any user's order.

**Status Codes:**

- 200 - OK: Order successfully retrieved
- 401 - Unauthorized: Invalid or missing authentication token
- 403 - Forbidden: User does not have admin privileges
- 404 - Not Found: Order not found

### Admin - Update Order Status (Admin Only)

Updates the status of an order (admin only).

**URL:** `PATCH /orders/:id/status`

**Auth Required:** Yes (Admin role)

**URL Parameters:**

| Name | Type   | Required | Description                     |
| ---- | ------ | -------- | ------------------------------- |
| id   | string | Yes      | The UUID of the order to update |

**Request Body:**

```json
{
  "status": "COMPLETED"
}
```

**Parameters:**

| Name   | Type   | Required | Description                                                        |
| ------ | ------ | -------- | ------------------------------------------------------------------ |
| status | string | Yes      | New order status (PENDING, COMPLETED, CANCELLED, REFUNDED, FAILED) |

**Response:**

```json
{
  "id": "order-uuid",
  "userId": "user-uuid",
  "licenseId": "license-uuid",
  "amount": 99.99,
  "currency": "USD",
  "status": "COMPLETED",
  "referenceNumber": "ORD-12345",
  "notes": "Enterprise license purchase",
  "createdAt": "2025-04-23T10:30:00Z",
  "updatedAt": "2025-04-23T10:45:00Z",
  "completedAt": "2025-04-23T10:45:00Z",
  "isActive": true,
  "expiresAt": "2026-04-23T10:45:00Z"
}
```

**Status Codes:**

- 200 - OK: Order status successfully updated
- 400 - Bad Request: Invalid status transition
- 401 - Unauthorized: Invalid or missing authentication token
- 403 - Forbidden: User does not have admin privileges
- 404 - Not Found: Order not found

## Payment Endpoints

### Process Payment

Processes a payment for an existing order.

**URL:** `POST /payments`

**Auth Required:** Yes

**Request Body:**

```json
{
  "orderId": "order-uuid",
  "amount": 99.99,
  "currency": "USD",
  "paymentMethod": "CREDIT_CARD",
  "transactionId": "tx_123456789",
  "paymentGatewayResponse": "{\"status\":\"success\",\"transactionId\":\"tx_123456789\"}"
}
```

**Parameters:**

| Name                   | Type   | Required | Description                                                     |
| ---------------------- | ------ | -------- | --------------------------------------------------------------- |
| orderId                | string | Yes      | The UUID of the order to pay for                                |
| amount                 | number | Yes      | The payment amount (must match order amount)                    |
| currency               | string | No       | Currency for the payment (USD, EUR). Defaults to order currency |
| paymentMethod          | string | Yes      | Payment method (CREDIT_CARD, PAYPAL, BANK_TRANSFER, STRIPE)     |
| transactionId          | string | No       | Transaction ID from external payment provider                   |
| paymentGatewayResponse | string | No       | Response data from payment gateway (JSON string)                |

**Response:**

```json
{
  "id": "payment-uuid",
  "orderId": "order-uuid",
  "amount": 99.99,
  "currency": "USD",
  "status": "PENDING",
  "paymentMethod": "CREDIT_CARD",
  "transactionId": "tx_123456789",
  "paymentGatewayResponse": "{\"status\":\"success\",\"transactionId\":\"tx_123456789\"}",
  "createdAt": "2025-04-23T10:50:00Z",
  "updatedAt": "2025-04-23T10:50:00Z",
  "processedAt": null
}
```

**Status Codes:**

- 201 - Created: Payment successfully processed
- 400 - Bad Request: Invalid input parameters or payment amount mismatch
- 401 - Unauthorized: Invalid or missing authentication token
- 404 - Not Found: Order not found

### Get Payment By ID

Retrieves a specific payment by its ID.

**URL:** `GET /payments/:id`

**Auth Required:** Yes

**URL Parameters:**

| Name | Type   | Required | Description                         |
| ---- | ------ | -------- | ----------------------------------- |
| id   | string | Yes      | The UUID of the payment to retrieve |

**Response:**

```json
{
  "id": "payment-uuid",
  "orderId": "order-uuid",
  "amount": 99.99,
  "currency": "USD",
  "status": "COMPLETED",
  "paymentMethod": "CREDIT_CARD",
  "transactionId": "tx_123456789",
  "paymentGatewayResponse": "{\"status\":\"success\",\"transactionId\":\"tx_123456789\"}",
  "createdAt": "2025-04-23T10:50:00Z",
  "updatedAt": "2025-04-23T10:52:00Z",
  "processedAt": "2025-04-23T10:52:00Z",
  "order": {
    "id": "order-uuid",
    "userId": "user-uuid",
    "status": "COMPLETED"
  }
}
```

**Status Codes:**

- 200 - OK: Payment successfully retrieved
- 401 - Unauthorized: Invalid or missing authentication token
- 404 - Not Found: Payment not found

### Get Payments By Order ID

Retrieves all payments for a specific order.

**URL:** `GET /payments/order/:orderId`

**Auth Required:** Yes

**URL Parameters:**

| Name    | Type   | Required | Description                               |
| ------- | ------ | -------- | ----------------------------------------- |
| orderId | string | Yes      | The UUID of the order to get payments for |

**Response:**

```json
[
  {
    "id": "payment-uuid",
    "orderId": "order-uuid",
    "amount": 99.99,
    "currency": "USD",
    "status": "COMPLETED",
    "paymentMethod": "CREDIT_CARD",
    "transactionId": "tx_123456789",
    "createdAt": "2025-04-23T10:50:00Z",
    "updatedAt": "2025-04-23T10:52:00Z",
    "processedAt": "2025-04-23T10:52:00Z",
    "order": {
      "id": "order-uuid",
      "status": "COMPLETED"
    }
  }
]
```

**Status Codes:**

- 200 - OK: Payments successfully retrieved
- 401 - Unauthorized: Invalid or missing authentication token
- 403 - Forbidden: Attempting to access another user's order payments
- 404 - Not Found: Order not found

### Admin - Get Payments By Order ID (Admin Only)

Retrieves all payments for any order (admin only).

**URL:** `GET /payments/admin/order/:orderId`

**Auth Required:** Yes (Admin role)

**URL Parameters:**

| Name    | Type   | Required | Description                               |
| ------- | ------ | -------- | ----------------------------------------- |
| orderId | string | Yes      | The UUID of the order to get payments for |

**Response:** Same as "Get Payments By Order ID" but can access any user's order payments.

**Status Codes:**

- 200 - OK: Payments successfully retrieved
- 401 - Unauthorized: Invalid or missing authentication token
- 403 - Forbidden: User does not have admin privileges
- 404 - Not Found: Order not found

### Admin - Update Payment Status (Admin Only)

Updates the status of a payment (admin only).

**URL:** `PATCH /payments/:id/status`

**Auth Required:** Yes (Admin role)

**URL Parameters:**

| Name | Type   | Required | Description                       |
| ---- | ------ | -------- | --------------------------------- |
| id   | string | Yes      | The UUID of the payment to update |

**Request Body:**

```json
{
  "status": "COMPLETED"
}
```

**Parameters:**

| Name   | Type   | Required | Description                                                          |
| ------ | ------ | -------- | -------------------------------------------------------------------- |
| status | string | Yes      | New payment status (PENDING, COMPLETED, FAILED, REFUNDED, CANCELLED) |

**Response:**

```json
{
  "id": "payment-uuid",
  "orderId": "order-uuid",
  "amount": 99.99,
  "currency": "USD",
  "status": "COMPLETED",
  "paymentMethod": "CREDIT_CARD",
  "transactionId": "tx_123456789",
  "createdAt": "2025-04-23T10:50:00Z",
  "updatedAt": "2025-04-23T11:00:00Z",
  "processedAt": "2025-04-23T11:00:00Z"
}
```

**Status Codes:**

- 200 - OK: Payment status successfully updated
- 401 - Unauthorized: Invalid or missing authentication token
- 403 - Forbidden: User does not have admin privileges
- 404 - Not Found: Payment not found

## License Purchase Endpoints

### Purchase License

Initiates the purchase of a license by creating an order.

**URL:** `POST /licenses/:id/purchase`

**Auth Required:** Yes

**URL Parameters:**

| Name | Type   | Required | Description                                |
| ---- | ------ | -------- | ------------------------------------------ |
| id   | string | Yes      | The UUID of the license option to purchase |

**Response:**

```json
{
  "id": "order-uuid",
  "userId": "user-uuid",
  "licenseId": "license-uuid",
  "amount": 99.99,
  "currency": "USD",
  "status": "PENDING",
  "referenceNumber": "ORD-12345",
  "notes": null,
  "createdAt": "2025-04-23T11:10:00Z",
  "updatedAt": "2025-04-23T11:10:00Z",
  "completedAt": null,
  "isActive": false,
  "expiresAt": null,
  "license": {
    "id": "license-uuid",
    "name": "Enterprise License",
    "description": "Full access to all features",
    "price": 99.99,
    "currency": "USD",
    "deploymentLimit": 10,
    "duration": 365,
    "features": ["Premium Support", "CI/CD Integration", "Custom Domain"]
  }
}
```

**Status Codes:**

- 201 - Created: License purchase initiated
- 401 - Unauthorized: Invalid or missing authentication token
- 404 - Not Found: License option not found

## User License Verification Endpoints

### Get Active Licenses

Retrieves all active licenses for the current user.

**URL:** `GET /user-licenses/active`

**Auth Required:** Yes

**Response:**

```json
[
  {
    "id": "order-uuid",
    "userId": "user-uuid",
    "licenseId": "license-uuid",
    "amount": 99.99,
    "currency": "USD",
    "status": "COMPLETED",
    "referenceNumber": "ORD-12345",
    "createdAt": "2025-04-23T10:30:00Z",
    "updatedAt": "2025-04-23T10:52:00Z",
    "completedAt": "2025-04-23T10:52:00Z",
    "isActive": true,
    "expiresAt": "2026-04-23T10:52:00Z",
    "license": {
      "id": "license-uuid",
      "name": "Enterprise License",
      "description": "Full access to all features",
      "price": 99.99,
      "currency": "USD",
      "deploymentLimit": 10,
      "duration": 365,
      "features": ["Premium Support", "CI/CD Integration", "Custom Domain"],
      "projects": [
        {
          "id": "project-uuid-1",
          "name": "Project 1"
        },
        {
          "id": "project-uuid-2",
          "name": "Project 2"
        }
      ]
    }
  }
]
```

**Status Codes:**

- 200 - OK: Active licenses successfully retrieved
- 401 - Unauthorized: Invalid or missing authentication token

### Check Active License

Checks if the user has an active license, optionally for a specific project.

**URL:** `GET /user-licenses/has-active`

**Auth Required:** Yes

**Query Parameters:**

| Name      | Type   | Required | Description                                  |
| --------- | ------ | -------- | -------------------------------------------- |
| projectId | string | No       | The UUID of the project to check license for |

**Response:**

```json
{
  "hasActiveLicense": true
}
```

**Status Codes:**

- 200 - OK: License check successful
- 401 - Unauthorized: Invalid or missing authentication token

### Get Specific Active License

Retrieves a specific active license for the current user.

**URL:** `GET /user-licenses/active/:licenseId`

**Auth Required:** Yes

**URL Parameters:**

| Name      | Type   | Required | Description                      |
| --------- | ------ | -------- | -------------------------------- |
| licenseId | string | Yes      | The UUID of the license to check |

**Response:**

```json
{
  "id": "order-uuid",
  "userId": "user-uuid",
  "licenseId": "license-uuid",
  "amount": 99.99,
  "currency": "USD",
  "status": "COMPLETED",
  "referenceNumber": "ORD-12345",
  "createdAt": "2025-04-23T10:30:00Z",
  "updatedAt": "2025-04-23T10:52:00Z",
  "completedAt": "2025-04-23T10:52:00Z",
  "isActive": true,
  "expiresAt": "2026-04-23T10:52:00Z",
  "license": {
    "id": "license-uuid",
    "name": "Enterprise License",
    "description": "Full access to all features",
    "price": 99.99,
    "currency": "USD",
    "deploymentLimit": 10,
    "duration": 365,
    "features": ["Premium Support", "CI/CD Integration", "Custom Domain"]
  }
}
```

**Status Codes:**

- 200 - OK: License successfully retrieved
- 401 - Unauthorized: Invalid or missing authentication token
- 404 - Not Found: Active license not found
