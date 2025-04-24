# Payment Module

## Overview

The Payment module is responsible for handling license purchases, payment processing, and order management within the Deploy Hub API. This module provides a complete system for tracking payments, managing orders, and ensuring proper license activation based on successful payments.

## Features

- Order creation and management
- Payment processing with support for multiple payment methods
- Order status tracking
- Payment history
- Integration with Licenses module

## Entities

### Order

The `Order` entity represents a purchase order for a license. It contains information about:

- User making the purchase
- License being purchased
- Amount and currency
- Order status (pending, completed, failed, cancelled, refunded)
- Payment reference information
- License activation status and expiration date

### Payment

The `Payment` entity represents individual payment transactions related to an order. It contains:

- Reference to the associated order
- Payment amount and currency
- Payment status (pending, completed, failed, refunded, cancelled)
- Payment method (credit card, PayPal, bank transfer, etc.)
- Transaction ID and payment gateway response

## Controllers

### OrderController

Provides REST endpoints for managing orders:

- `POST /orders` - Create a new order
- `GET /orders` - Get all orders for the current user
- `GET /orders/:id` - Get a specific order
- `GET /orders/admin` - Admin endpoint to get all orders
- `GET /orders/admin/:id` - Admin endpoint to get a specific order
- `PATCH /orders/:id/status` - Admin endpoint to update order status

### PaymentController

Provides REST endpoints for processing payments:

- `POST /payments` - Process a payment for an order
- `GET /payments/:id` - Get payment details
- `GET /payments/order/:orderId` - Get all payments for an order
- `GET /payments/admin/order/:orderId` - Admin endpoint to get payments for any order
- `PATCH /payments/:id/status` - Admin endpoint to update payment status

## Services

### OrderService

Manages orders and provides methods for:

- Creating orders
- Finding and filtering orders
- Updating order status
- Activating licenses on successful payment

### PaymentService

Handles payment processing and provides methods for:

- Processing payments for orders
- Finding payment information
- Updating payment status
- Integration with payment gateways (simulated in the current implementation)

## Usage

### Creating an Order

```typescript
// Example: Creating a new order
const createOrderDto: CreateOrderDto = {
  licenseId: 'license-uuid',
  currency: Currency.USD,
  notes: 'Enterprise license purchase',
};

const order = await orderService.create(userId, createOrderDto);
```

### Processing a Payment

```typescript
// Example: Processing a payment for an order
const createPaymentDto: CreatePaymentDto = {
  orderId: 'order-uuid',
  amount: 99.99,
  currency: Currency.USD,
  paymentMethod: PaymentMethod.CREDIT_CARD,
  transactionId: 'external-transaction-id',
};

const payment = await paymentService.processPayment(userId, createPaymentDto);
```

## Integration with Other Modules

The Payment module is tightly integrated with the Licenses module to enable license purchases and activation. When a payment is successfully completed:

1. The order status is updated to `COMPLETED`
2. The license becomes active for the user
3. The license expiration date is set based on the license duration

## Error Handling

The module includes comprehensive error handling for various scenarios:

- Invalid payment amounts
- Order not found
- Invalid payment status transitions
- Invalid order status transitions
