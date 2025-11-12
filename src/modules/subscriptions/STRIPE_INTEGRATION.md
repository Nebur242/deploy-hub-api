# Stripe Integration Guide

This guide explains how to integrate Stripe payment processing with the subscription module for handling recurring billing, payment methods, and subscription lifecycle management.

## Overview

The Stripe integration provides:

- **Customer Management**: Automatic Stripe customer creation
- **Subscription Management**: Create, update, and cancel Stripe subscriptions
- **Webhook Processing**: Handle Stripe events for real-time updates
- **Payment Methods**: Setup and manage payment methods
- **Billing Portal**: Customer self-service billing portal

## Setup

### 1. Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... # Your Stripe secret key
STRIPE_PUBLISHABLE_KEY=pk_test_... # Your Stripe publishable key
STRIPE_WEBHOOK_SECRET=whsec_... # Webhook endpoint secret

# Optional: For production
STRIPE_WEBHOOK_ENDPOINT_URL=https://yourdomain.com/api/v1/webhooks/stripe
```

### 2. Stripe Dashboard Setup

1. **Create Products and Prices**:

   - Go to Stripe Dashboard > Products
   - Create products for each subscription plan
   - Add recurring prices (monthly/yearly)
   - Copy the Product ID and Price ID to your database

2. **Setup Webhooks**:
   - Go to Stripe Dashboard > Developers > Webhooks
   - Add endpoint: `https://yourdomain.com/api/v1/webhooks/stripe`
   - Select these events:
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
     - `customer.subscription.trial_will_end`

### 3. Database Migration

Ensure your subscription entities have Stripe fields:

```sql
-- Add to subscription_plans table
ALTER TABLE subscription_plans ADD COLUMN stripe_product_id VARCHAR(255);
ALTER TABLE subscription_plans ADD COLUMN stripe_price_id VARCHAR(255);

-- Add to user_subscriptions table
ALTER TABLE user_subscriptions ADD COLUMN stripe_subscription_id VARCHAR(255);
ALTER TABLE user_subscriptions ADD COLUMN stripe_customer_id VARCHAR(255);
```

## Usage

### 1. Creating a Stripe Subscription

```typescript
import { StripeService } from './services/stripe.service';
import { UserSubscriptionService } from './services/user-subscription.service';

// In your controller or service
async createSubscriptionWithStripe(user: User, planId: string, paymentMethodId: string) {
  // 1. Get the subscription plan
  const plan = await this.subscriptionPlanService.findOne(planId);

  // 2. Create or get Stripe customer
  const stripeCustomer = await this.stripeService.createOrGetCustomer(user);

  // 3. Create Stripe subscription
  const stripeSubscription = await this.stripeService.createSubscription(
    stripeCustomer.id,
    plan.stripePriceId,
    {
      paymentMethodId,
      metadata: {
        userId: user.id,
        planId: plan.id,
      },
    }
  );

  // 4. Create local subscription record
  const subscription = await this.userSubscriptionService.createSubscription(user, {
    planId: plan.id,
    paymentMethodId,
    autoRenew: true,
    metadata: {
      stripeSubscriptionId: stripeSubscription.id,
      stripeCustomerId: stripeCustomer.id,
    },
  });

  return subscription;
}
```

### 2. Upgrading a Subscription

```typescript
async upgradeSubscriptionWithStripe(userId: string, newPlanId: string) {
  // 1. Get current subscription
  const currentSubscription = await this.userSubscriptionService.getCurrentSubscription(userId);

  // 2. Get new plan
  const newPlan = await this.subscriptionPlanService.findOne(newPlanId);

  // 3. Update Stripe subscription
  const updatedStripeSubscription = await this.stripeService.updateSubscription(
    currentSubscription.stripeSubscriptionId,
    newPlan.stripePriceId,
    {
      prorationBehavior: 'create_prorations', // Prorate the upgrade
    }
  );

  // 4. Update local subscription
  const updatedSubscription = await this.userSubscriptionService.upgradePlan(
    userId,
    newPlanId,
    {
      metadata: {
        upgradedAt: new Date().toISOString(),
        stripeSubscriptionId: updatedStripeSubscription.id,
      },
    }
  );

  return updatedSubscription;
}
```

### 3. Canceling a Subscription

```typescript
async cancelSubscriptionWithStripe(userId: string, cancelAtPeriodEnd = true) {
  const subscription = await this.userSubscriptionService.getCurrentSubscription(userId);

  // Cancel in Stripe
  await this.stripeService.cancelSubscription(
    subscription.stripeSubscriptionId,
    {
      cancelAtPeriodEnd,
      cancellationReason: 'user_requested',
    }
  );

  // Update local record
  return this.userSubscriptionService.cancelSubscription(userId, subscription.id);
}
```

### 4. Creating a Billing Portal Session

```typescript
async createBillingPortalSession(userId: string, returnUrl: string) {
  const subscription = await this.userSubscriptionService.getCurrentSubscription(userId);

  const portalUrl = await this.stripeService.createBillingPortalSession(
    subscription.stripeCustomerId,
    returnUrl
  );

  return { url: portalUrl };
}
```

## Frontend Integration

### 1. Payment Method Setup

```typescript
// Frontend: Setup payment method
import { loadStripe } from '@stripe/stripe-js';

const stripe = await loadStripe('pk_test_...');

// Create setup intent
const { client_secret } = await fetch('/api/v1/payments/setup-intent', {
  method: 'POST',
}).then(r => r.json());

// Confirm setup intent
const { error, setupIntent } = await stripe.confirmCardSetup(client_secret, {
  payment_method: {
    card: cardElement,
    billing_details: {
      name: 'Customer name',
      email: 'customer@example.com',
    },
  },
});

if (!error) {
  // Use setupIntent.payment_method.id when creating subscription
  console.log('Payment method setup successful:', setupIntent.payment_method.id);
}
```

### 2. Subscription Creation

```typescript
// Frontend: Create subscription
async function createSubscription(planId: string, paymentMethodId: string) {
  const response = await fetch('/api/v1/user-subscriptions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      planId,
      paymentMethodId,
      autoRenew: true,
    }),
  });

  const subscription = await response.json();

  // Handle 3D Secure if needed
  if (subscription.latest_invoice?.payment_intent?.status === 'requires_action') {
    const { error } = await stripe.confirmCardPayment(
      subscription.latest_invoice.payment_intent.client_secret,
    );

    if (error) {
      console.error('Payment failed:', error);
    } else {
      console.log('Payment successful!');
    }
  }

  return subscription;
}
```

## Webhook Handling

The webhook controller automatically handles Stripe events:

### Handled Events

1. **`customer.subscription.created`**: Updates local subscription status
2. **`customer.subscription.updated`**: Syncs subscription changes
3. **`customer.subscription.deleted`**: Marks subscription as cancelled
4. **`invoice.payment_succeeded`**: Updates payment status and dates
5. **`invoice.payment_failed`**: Marks subscription as past due
6. **`customer.subscription.trial_will_end`**: Sends trial ending notifications

### Webhook Security

The webhook controller verifies Stripe signatures to ensure security:

```typescript
// Automatic signature verification
const event = this.stripeService.constructEvent(req.rawBody, signature);
```

## Error Handling

### Common Errors

1. **Payment Failed**: Subscription marked as `past_due`
2. **Card Declined**: Handle in frontend with retry logic
3. **Webhook Signature Invalid**: Check endpoint secret
4. **Plan Not Found**: Verify Stripe Price ID in database

### Error Recovery

```typescript
// Retry failed payments
async retryFailedPayment(subscriptionId: string) {
  try {
    const invoice = await stripe.invoices.retrieve(
      subscription.latest_invoice.id
    );

    await stripe.invoices.pay(invoice.id);

    // Update local subscription status
    await this.userSubscriptionService.updateSubscriptionStatus(
      subscriptionId,
      SubscriptionStatus.ACTIVE
    );
  } catch (error) {
    console.error('Payment retry failed:', error);
  }
}
```

## Testing

### Test Cards

Use Stripe test cards for development:

```typescript
// Successful payment
const testCard = '4242424242424242';

// Requires 3D Secure
const testCard3DS = '4000002760003184';

// Declined card
const declinedCard = '4000000000000002';
```

### Webhook Testing

Use Stripe CLI for local webhook testing:

```bash
# Install Stripe CLI
npm install -g stripe-cli

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe

# Trigger test events
stripe trigger customer.subscription.created
stripe trigger invoice.payment_succeeded
```

## Production Considerations

### 1. Security

- Use HTTPS for all webhook endpoints
- Verify webhook signatures
- Store sensitive data securely
- Use environment variables for keys

### 2. Monitoring

- Monitor webhook delivery in Stripe Dashboard
- Set up alerts for failed payments
- Track subscription metrics
- Monitor API rate limits

### 3. Compliance

- PCI DSS compliance (handled by Stripe)
- Data retention policies
- GDPR compliance for EU customers
- Tax calculation (Stripe Tax)

### 4. Performance

- Use webhook retries for failed deliveries
- Implement idempotency for webhook processing
- Cache frequently accessed data
- Use database indexing for Stripe IDs

## API Endpoints

### Payment Setup

```typescript
POST /api/v1/payments/setup-intent
GET /api/v1/payments/methods
DELETE /api/v1/payments/methods/:id
```

### Subscriptions

```typescript
POST /api/v1/user-subscriptions (with paymentMethodId)
PUT /api/v1/user-subscriptions/upgrade/:planId
GET /api/v1/user-subscriptions/billing-portal
```

### Webhooks

```typescript
POST /api/v1/webhooks/stripe (Stripe webhook endpoint)
```

## Troubleshooting

### Common Issues

1. **Webhook not firing**: Check endpoint URL and selected events
2. **Payment failing**: Verify payment method and customer details
3. **Subscription not syncing**: Check webhook processing logs
4. **3D Secure issues**: Implement proper frontend handling

### Debug Tools

- Stripe Dashboard Events log
- Webhook endpoint logs
- Application logs for webhook processing
- Stripe CLI for local testing

### Support

- Stripe Documentation: https://stripe.com/docs
- Stripe Support: https://support.stripe.com
- Community Forum: https://github.com/stripe/stripe-node/discussions

This integration provides a robust foundation for handling subscription billing with Stripe while maintaining data consistency between your application and Stripe's systems.
