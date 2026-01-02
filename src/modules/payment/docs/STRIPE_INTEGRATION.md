# Stripe Backend Integration Guide

## Overview

The DeployHub API includes a complete Stripe integration for processing credit/debit card payments. The `StripeService` handles all Stripe API interactions, while the payment controller exposes REST endpoints for frontend payment operations.

## Architecture

```
Frontend (React/Next.js)
    ↓
PaymentMethodSelector
    ↓
StripePaymentForm (uses Stripe Elements)
    ↓
PaymentController
    ↓
StripeService
    ↓
Stripe API
```

## Backend Setup

### 1. Environment Variables

Add these to your `.env` file:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxx          # From Stripe Dashboard
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx        # For webhook validation
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxxxxxxxxx     # For frontend initialization endpoint
```

### 2. Module Structure

The payment module is organized as:

```
src/modules/payment/
├── controllers/
│   └── payment.controller.ts       # REST endpoints
├── services/
│   ├── payment.service.ts          # Order payment logic
│   └── stripe.service.ts           # Stripe API integration
├── dto/
│   ├── create-payment.dto.ts       # General payment DTO
│   └── stripe-payment.dto.ts       # Stripe-specific DTOs
├── entities/
│   └── payment.entity.ts           # Payment database model
└── payment.module.ts               # Module configuration
```

## API Endpoints

### 1. Create Payment Intent

**Endpoint:** `POST /payments/stripe/create-intent`

**Authentication:** Required (Bearer token)

**Description:** Initialize a Stripe payment intent for card payment. The frontend will use the returned `clientSecret` to confirm the payment with Stripe Elements.

**Request Body:**

```typescript
{
  orderId: string;              // UUID of order being paid for
  amount: number;               // Amount in dollars (e.g., 99.99)
  currency: Currency;           // Currency enum (USD, EUR, etc)
  customerEmail?: string;       // Optional customer email
  licenseId?: string;          // Optional license ID being purchased
}
```

**Example Request:**

```bash
curl -X POST http://localhost:3001/payments/stripe/create-intent \
  -H "Authorization: Bearer <user-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 99.99,
    "currency": "USD",
    "customerEmail": "user@example.com"
  }'
```

**Response (201 Created):**

```json
{
  "clientSecret": "pi_1234567890_secret_987654321",
  "paymentIntentId": "pi_1234567890",
  "status": "requires_payment_method",
  "amount": 99.99,
  "currency": "USD"
}
```

**Response Codes:**

- `201`: Payment intent created successfully
- `400`: Invalid amount or missing required fields
- `401`: User not authenticated
- `500`: Stripe API error

### 2. Confirm Payment

**Endpoint:** `POST /payments/stripe/confirm`

**Authentication:** Required (Bearer token)

**Description:** Verify that a payment has been successfully confirmed with Stripe. Called after frontend has confirmed the payment using Stripe Elements.

**Request Body:**

```typescript
{
  paymentIntentId: string; // From create-intent response
}
```

**Example Request:**

```bash
curl -X POST http://localhost:3001/payments/stripe/confirm \
  -H "Authorization: Bearer <user-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentIntentId": "pi_1234567890"
  }'
```

**Response (201 Created):**

```json
{
  "paymentIntentId": "pi_1234567890",
  "status": "succeeded",
  "amount": "99.99",
  "currency": "usd",
  "chargeId": "ch_1234567890",
  "created": 1704067200,
  "metadata": {
    "orderId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "550e8400-e29b-41d4-a716-446655440001"
  }
}
```

**Response Codes:**

- `201`: Payment confirmed
- `400`: Invalid payment intent ID
- `401`: User not authenticated
- `500`: Stripe API error

### 3. Get Payment Status

**Endpoint:** `GET /payments/stripe/:paymentIntentId`

**Authentication:** Required (Bearer token)

**Description:** Check the current status of a payment intent at any time.

**Example Request:**

```bash
curl -X GET http://localhost:3001/payments/stripe/pi_1234567890 \
  -H "Authorization: Bearer <user-token>"
```

**Response (200 OK):**

```json
{
  "paymentIntentId": "pi_1234567890",
  "status": "succeeded",
  "amount": "99.99",
  "currency": "usd",
  "metadata": {
    "orderId": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "550e8400-e29b-41d4-a716-446655440001"
  },
  "created": 1704067200
}
```

### 4. Get Stripe Publishable Key

**Endpoint:** `GET /payments/stripe/config/publishable-key`

**Authentication:** Not required

**Description:** Returns the Stripe publishable key needed to initialize Stripe Elements on the frontend.

**Example Request:**

```bash
curl -X GET http://localhost:3001/payments/stripe/config/publishable-key
```

**Response (200 OK):**

```json
{
  "publishableKey": "pk_test_xxxxxxxxxxxx"
}
```

## StripeService API

The `StripeService` is injectable and provides these methods:

### createPaymentIntent(dto)

Create a Stripe payment intent.

```typescript
const result = await this.stripeService.createPaymentIntent({
  orderId: '550e8400-e29b-41d4-a716-446655440000',
  amount: 99.99,
  currency: 'USD',
  userId: '550e8400-e29b-41d4-a716-446655440001',
  customerEmail: 'user@example.com',
});

// Returns:
{
  clientSecret: 'pi_1234567890_secret_987654321',
  paymentIntentId: 'pi_1234567890',
  status: 'requires_payment_method',
  amount: 99.99,
  currency: 'USD'
}
```

### confirmPayment(dto)

Confirm a payment intent after frontend confirmation.

```typescript
const result = await this.stripeService.confirmPayment({
  paymentIntentId: 'pi_1234567890'
});

// Returns:
{
  paymentIntentId: 'pi_1234567890',
  status: 'succeeded',
  amount: '99.99',
  currency: 'usd',
  chargeId: 'ch_1234567890',
  created: 1704067200,
  metadata: { ... }
}
```

### getPaymentIntent(paymentIntentId)

Retrieve payment intent details.

```typescript
const payment = await this.stripeService.getPaymentIntent('pi_1234567890');
```

### refundCharge(chargeId, amount?)

Process a refund for a completed payment.

```typescript
const refund = await this.stripeService.refundCharge('ch_1234567890', 9999);
// Amount is in cents (9999 = $99.99)
// Omit amount parameter for full refund

// Returns:
{
  refundId: 're_1234567890',
  status: 'succeeded',
  amount: '99.99',
  chargeId: 'ch_1234567890'
}
```

### verifyWebhookSignature(body, signature)

Verify Stripe webhook signature (for webhook endpoints).

```typescript
try {
  const event = this.stripeService.verifyWebhookSignature(body, signature);

  switch (event.type) {
    case 'payment_intent.succeeded':
      // Handle successful payment
      break;
    case 'payment_intent.payment_failed':
      // Handle failed payment
      break;
  }
} catch (error) {
  // Invalid signature
}
```

### getPublishableKey()

Get the Stripe publishable key.

```typescript
const key = this.stripeService.getPublishableKey();
// Returns: 'pk_test_xxxxxxxxxxxx'
```

### isConfigured()

Check if Stripe is properly configured.

```typescript
if (this.stripeService.isConfigured()) {
  // Stripe is ready to use
}
```

## Payment Flow

### Frontend → Backend Payment Flow

1. **Initialize Payment**

   - Frontend loads Stripe Elements
   - User selects "Stripe" payment method
   - Frontend calls `POST /payments/stripe/create-intent`

2. **Display Payment Form**

   - Backend returns `clientSecret` and `paymentIntentId`
   - Frontend shows CardElement
   - User enters card details

3. **Confirm Payment**

   - User clicks "Pay" button
   - Frontend confirms payment using `stripe.confirmCardPayment(clientSecret, ...)`
   - Stripe processes payment and returns result

4. **Verify Payment**

   - Frontend calls `POST /payments/stripe/confirm` with `paymentIntentId`
   - Backend checks payment status with Stripe
   - Backend updates order status and creates license

5. **Webhook Confirmation (optional)**
   - Stripe sends `payment_intent.succeeded` webhook
   - Backend processes webhook and confirms license activation

### Complete Integration Example

Here's how a payment flow would work:

```typescript
// Frontend: Create payment intent
const response = await fetch('/api/payments/stripe/create-intent', {
  method: 'POST',
  body: JSON.stringify({
    orderId: '550e8400-e29b-41d4-a716-446655440000',
    amount: 99.99,
    currency: 'USD',
  }),
  headers: { Authorization: `Bearer ${token}` },
});

const { clientSecret } = await response.json();

// Frontend: Confirm payment with card
const result = await stripe.confirmCardPayment(clientSecret, {
  payment_method: {
    card: cardElement,
    billing_details: {
      /* ... */
    },
  },
});

if (result.paymentIntent.status === 'succeeded') {
  // Frontend: Confirm with backend
  const confirmResponse = await fetch('/api/payments/stripe/confirm', {
    method: 'POST',
    body: JSON.stringify({
      paymentIntentId: result.paymentIntent.id,
    }),
    headers: { Authorization: `Bearer ${token}` },
  });

  const payment = await confirmResponse.json();
  // Order is now paid, license activated
}
```

## Error Handling

The StripeService throws specific errors:

| Error Type                   | Status | When                                              | Handling                   |
| ---------------------------- | ------ | ------------------------------------------------- | -------------------------- |
| BadRequestException          | 400    | Invalid amount, missing fields, invalid intent ID | Show user-friendly message |
| InternalServerErrorException | 500    | Stripe API failure, missing config                | Log error, notify user     |

Example error handling:

```typescript
try {
  await this.stripeService.createPaymentIntent(dto);
} catch (error) {
  if (error instanceof BadRequestException) {
    // User error - show to user
    res.status(400).json({ error: error.message });
  } else if (error instanceof InternalServerErrorException) {
    // Server error - log and show generic message
    console.error(error);
    res.status(500).json({ error: 'Payment processing failed' });
  }
}
```

## Amount Handling

**Important:** Stripe amounts are always in cents (smallest currency unit).

The StripeService handles conversion automatically:

```typescript
// Frontend sends: amount: 99.99 (in dollars)
// StripeService converts to: Math.round(99.99 * 100) = 9999 cents
// Response returns: "99.99" (back in dollars)

// When refunding:
await stripeService.refundCharge('ch_xxx', 9999); // Amount in cents
```

## Testing

### Test Cards

Use these test card numbers in test mode:

| Card             | Scenario           | Expiry | CVC  |
| ---------------- | ------------------ | ------ | ---- |
| 4242424242424242 | Successful payment | 12/25  | 123  |
| 4000000000000002 | Card declined      | 12/25  | 123  |
| 4000002500003155 | 3D Secure required | 12/25  | 123  |
| 378282246310005  | American Express   | 12/25  | 1234 |
| 6011111111111117 | Discover           | 12/25  | 123  |

### Testing with cURL

```bash
# 1. Create payment intent
curl -X POST http://localhost:3001/payments/stripe/create-intent \
  -H "Authorization: Bearer <your-test-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "test-order-123",
    "amount": 99.99,
    "currency": "USD"
  }'

# Response:
{
  "clientSecret": "pi_1234567890_secret_xxx",
  "paymentIntentId": "pi_1234567890",
  "status": "requires_payment_method",
  "amount": 99.99,
  "currency": "USD"
}

# 2. On frontend, use clientSecret to confirm payment with card element

# 3. Confirm payment
curl -X POST http://localhost:3001/payments/stripe/confirm \
  -H "Authorization: Bearer <your-test-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentIntentId": "pi_1234567890"
  }'

# Response:
{
  "paymentIntentId": "pi_1234567890",
  "status": "succeeded",
  "amount": "99.99",
  "currency": "usd",
  "chargeId": "ch_1234567890",
  "created": 1704067200,
  "metadata": { ... }
}
```

## Webhooks (Coming Soon)

Webhooks allow Stripe to notify your backend of payment events without relying on frontend confirmation.

**Recommended webhook events:**

- `payment_intent.succeeded`: Payment successful
- `payment_intent.payment_failed`: Payment failed
- `charge.refunded`: Refund processed
- `charge.dispute.created`: Chargeback initiated

**Setting up webhooks:**

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. Enter: `https://your-api.com/webhooks/stripe`
4. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
5. Copy signing secret to `STRIPE_WEBHOOK_SECRET` in `.env`

## Security Considerations

1. **Never log sensitive data**

   - Never log full card numbers
   - Never log secret keys
   - Never log client secrets in production

2. **Validate on backend**

   - Always verify amounts match
   - Always verify payment status with Stripe
   - Never trust frontend payment confirmation alone

3. **Use HTTPS**

   - All payment endpoints must be HTTPS
   - Stripe Elements requires secure context

4. **PCI Compliance**

   - Never handle raw card data
   - Always use Stripe Elements
   - Implement proper error handling
   - Regular security audits

5. **Metadata Usage**
   - Store order IDs and user IDs in payment metadata
   - Use for reconciliation and tracking
   - Helps prevent amount mismatches

## Monitoring

Monitor these payment metrics:

```typescript
// Monitor payment intent creation
Logger.log(`Payment intent created: ${paymentIntentId}`);

// Monitor payment success
Logger.log(`Payment succeeded: ${chargeId}`);

// Monitor failures
Logger.error(`Payment failed: ${paymentIntentId}`, error);

// Monitor refunds
Logger.log(`Refund processed: ${refundId}`);
```

## Troubleshooting

### "STRIPE_SECRET_KEY is not configured"

**Cause:** Missing `STRIPE_SECRET_KEY` in `.env`

**Fix:**

1. Add `STRIPE_SECRET_KEY=sk_test_xxxx` to `.env`
2. Restart the application

### "Payment intent creation failed"

**Cause:** Stripe API error (network, auth, etc)

**Fix:**

1. Verify `STRIPE_SECRET_KEY` is correct
2. Check Stripe Dashboard for API status
3. Check server logs for detailed error

### "Payment intent not found"

**Cause:** Invalid or expired payment intent ID

**Fix:**

1. Create a new payment intent (old ones expire after 24 hours)
2. Verify payment intent ID is correct

### "Webhook signature verification failed"

**Cause:** Missing or incorrect `STRIPE_WEBHOOK_SECRET`

**Fix:**

1. Get webhook signing secret from Stripe Dashboard
2. Add to `.env` as `STRIPE_WEBHOOK_SECRET`

## Production Checklist

Before deploying to production:

- [ ] Switch to live Stripe keys (`pk_live_*` and `sk_live_*`)
- [ ] Set up webhook endpoint in Stripe Dashboard
- [ ] Enable HTTPS for all payment endpoints
- [ ] Configure error logging and monitoring
- [ ] Test with small transaction amounts
- [ ] Set up email notifications for failed payments
- [ ] Implement refund process
- [ ] Review security settings
- [ ] Implement rate limiting on payment endpoints
- [ ] Set up PCI compliance checks

## Additional Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe API Reference](https://stripe.com/docs/api)
- [Stripe Payment Intents](https://stripe.com/docs/payments/payment-intents)
- [Stripe Testing](https://stripe.com/docs/testing)
- [PCI Compliance](https://stripe.com/docs/security)
- [Stripe CLI for webhook testing](https://stripe.com/docs/stripe-cli)

## Support

For issues with:

- **Stripe Integration:** Check StripeService implementation or Stripe docs
- **Payment Flow:** Review PaymentController endpoints
- **Frontend Integration:** Check next `docs/STRIPE_SETUP.md`
- **Webhooks:** See Stripe webhook documentation
