# Subscription Module Postman Collection

This Postman collection provides comprehensive testing for the Subscription Module API including Stripe payment integration.

## Collection Overview

**Version**: 2.0.0  
**Total Endpoints**: 25+ endpoints  
**Categories**:

- Subscription Plans Management
- User Subscriptions
- Stripe Payment Integration
- Webhook Testing
- Admin Operations

## Setup Instructions

### 1. Import Collection

1. Open Postman
2. Click "Import" button
3. Select `subscription-module-collection.json`
4. Collection will be imported with all variables and requests

### 2. Configure Environment Variables

Set the following variables in the collection:

| Variable                 | Description              | Example Value                  |
| ------------------------ | ------------------------ | ------------------------------ |
| `BASE_URI`               | API base URL             | `http://localhost:3000/api/v1` |
| `ACCESS_TOKEN`           | Bearer token for auth    | `your.jwt.token.here`          |
| `PLAN_ID`                | Subscription plan ID     | Auto-extracted from responses  |
| `SUBSCRIPTION_ID`        | User subscription ID     | Auto-extracted from responses  |
| `STRIPE_CUSTOMER_ID`     | Stripe customer ID       | Auto-extracted from responses  |
| `PAYMENT_METHOD_ID`      | Stripe payment method ID | `pm_card_visa`                 |
| `STRIPE_SUBSCRIPTION_ID` | Stripe subscription ID   | Auto-extracted from responses  |

### 3. Authentication Setup

The collection uses Bearer token authentication. To get an access token:

1. Use your authentication endpoint to get a JWT token
2. Set the `ACCESS_TOKEN` variable with the token value
3. All authenticated requests will automatically use this token

## Collection Structure

### 📁 Subscription Plans

Public and admin endpoints for managing subscription plans.

#### Public Endpoints (No Auth)

- **Get Public Plans** - View available subscription plans

#### Admin Endpoints (Admin Role Required)

- **Create Plan** - Create new subscription plan
- **Get All Plans** - List all plans with filtering
- **Get Plan Details** - Get specific plan information
- **Update Plan** - Modify existing plan
- **Delete Plan** - Remove plan
- **Plan Statistics** - Usage analytics

### 📁 User Subscriptions

User subscription management and lifecycle operations.

#### User Endpoints

- **Create Subscription** - Subscribe to a plan
- **Get Current Subscription** - View active subscription
- **Get Subscription Limits** - Check usage limits and features
- **Get Upgrade Options** - View available upgrade plans
- **Upgrade Plan** - Upgrade to higher tier
- **Get Upgrade Pricing** - Calculate upgrade costs
- **Schedule Upgrade** - Schedule upgrade for next billing cycle
- **Get Analytics** - Subscription history and metrics
- **Cancel Subscription** - Cancel active subscription
- **Can Downgrade** - Check downgrade eligibility
- **Get History** - View subscription history

#### Admin Endpoints

- **Get All Subscriptions** - View all user subscriptions with filtering
- **Process Scheduled Upgrades** - Trigger scheduled upgrade processing

### 📁 Stripe Integration

Payment processing and Stripe-specific operations.

#### Payment Management

- **Create Setup Intent** - Setup payment method saving
- **Get Payment Methods** - List customer payment methods
- **Create Payment Intent** - Process one-time payments
- **Create Billing Portal** - Generate customer billing portal session

#### Subscription with Stripe

- **Subscription with Stripe - Create** - Create subscription with Stripe payment
- **Subscription with Stripe - Upgrade** - Upgrade with Stripe proration

#### Webhook Testing

- **Stripe Webhook - Test Event** - Test webhook processing

## Usage Workflows

### 1. Create and Test Subscription Plans

```
1. Create Plan (Admin) → Auto-extracts PLAN_ID
2. Get Public Plans → Verify plan appears
3. Update Plan (Admin) → Modify plan details
4. Plan Statistics (Admin) → View usage stats
```

### 2. User Subscription Lifecycle

```
1. Get Public Plans → Choose a plan
2. Create Subscription → Subscribe with PLAN_ID
3. Get Current Subscription → Verify active subscription
4. Get Subscription Limits → Check features/limits
5. Get Upgrade Options → View available upgrades
6. Upgrade Plan → Upgrade to higher tier
7. Cancel Subscription → End subscription
```

### 3. Stripe Payment Integration

```
1. Create Setup Intent → Setup payment method
2. Create Subscription with Stripe → Subscribe with payment
3. Create Billing Portal → Customer self-service
4. Upgrade with Stripe → Proration handling
5. Test Webhooks → Verify event processing
```

### 4. Admin Operations

```
1. Create Plans → Setup subscription tiers
2. Get All Subscriptions → Monitor all users
3. Plan Statistics → Analyze usage
4. Process Scheduled Upgrades → Batch operations
```

## Sample Test Data

### Test Subscription Plans

```json
// Pro Monthly Plan
{
  "name": "Pro Monthly",
  "description": "Professional plan with unlimited projects",
  "price": 20,
  "currency": "USD",
  "type": "monthly",
  "maxProjects": 0,
  "maxDeployments": 0,
  "maxTeamMembers": 5,
  "features": [
    "unlimited_projects",
    "unlimited_deployments",
    "custom_domains",
    "priority_support"
  ],
  "popular": true,
  "stripeProductId": "prod_test_product",
  "stripePriceId": "price_test_monthly"
}

// Pro Annual Plan
{
  "name": "Pro Annual",
  "description": "Professional plan with annual discount",
  "price": 199,
  "currency": "USD",
  "type": "annual",
  "maxProjects": 0,
  "maxDeployments": 0,
  "maxTeamMembers": 5,
  "features": [
    "unlimited_projects",
    "unlimited_deployments",
    "custom_domains",
    "priority_support",
    "advanced_analytics"
  ],
  "stripeProductId": "prod_test_product",
  "stripePriceId": "price_test_annual"
}
```

### Test Stripe Payment Methods

Use these test payment method IDs for development:

```javascript
// Successful card
PAYMENT_METHOD_ID = 'pm_card_visa';

// 3D Secure required
PAYMENT_METHOD_ID = 'pm_card_threeDSecure2Required';

// Declined card
PAYMENT_METHOD_ID = 'pm_card_chargeDeclined';
```

## Automated Features

### Auto-ID Extraction

The collection automatically extracts and sets important IDs from responses:

- `PLAN_ID` from plan creation/listing
- `SUBSCRIPTION_ID` from subscription operations
- `STRIPE_CUSTOMER_ID` from Stripe customer creation
- `STRIPE_SUBSCRIPTION_ID` from Stripe subscriptions
- `SETUP_INTENT_ID` and `CLIENT_SECRET` from payment setup

### Common Tests

Each request includes automatic tests for:

- Response time validation
- Status code verification
- Content-Type header validation
- Response structure validation

### Error Handling

The collection handles common error scenarios:

- Authentication failures
- Validation errors
- Resource not found
- Rate limiting
- Stripe webhook signature validation

## Environment Setup

### Development Environment

```json
{
  "BASE_URI": "http://localhost:3000/api/v1",
  "ACCESS_TOKEN": "your-dev-token",
  "PAYMENT_METHOD_ID": "pm_card_visa"
}
```

### Staging Environment

```json
{
  "BASE_URI": "https://staging-api.yourapp.com/api/v1",
  "ACCESS_TOKEN": "your-staging-token",
  "PAYMENT_METHOD_ID": "pm_card_visa"
}
```

### Production Environment

```json
{
  "BASE_URI": "https://api.yourapp.com/api/v1",
  "ACCESS_TOKEN": "your-production-token",
  "PAYMENT_METHOD_ID": "pm_card_visa"
}
```

## Testing Strategies

### 1. Unit Testing Approach

Test individual endpoints in isolation:

- Create plan → Verify response
- Get plan → Verify data integrity
- Update plan → Verify changes
- Delete plan → Verify removal

### 2. Integration Testing

Test complete workflows:

- User registration → Plan selection → Subscription creation → Payment processing
- Subscription upgrade → Proration → Billing update
- Webhook processing → Database sync

### 3. Stripe Integration Testing

Use Stripe test mode:

- Test payment method setup
- Test subscription creation
- Test webhook event processing
- Test billing portal functionality

### 4. Load Testing

For performance testing:

- Use collection runner with multiple iterations
- Test concurrent subscription creation
- Monitor API rate limits
- Verify webhook processing under load

## Troubleshooting

### Common Issues

1. **Authentication Errors**

   - Verify ACCESS_TOKEN is set and valid
   - Check token expiration
   - Ensure proper user roles for admin endpoints

2. **Stripe Integration Issues**

   - Verify Stripe keys in environment
   - Check webhook endpoint configuration
   - Validate test payment method IDs

3. **Variable Extraction Failures**

   - Check response structure
   - Verify ID fields exist in responses
   - Review auto-extraction script logs

4. **Webhook Testing Problems**
   - Use proper Stripe signature format
   - Verify webhook secret configuration
   - Check event payload structure

### Debug Tips

- Enable Postman console for detailed logs
- Use pre-request scripts for dynamic data
- Check response headers for rate limiting
- Monitor server logs for error details

## Contributing

To add new endpoints to the collection:

1. Follow the existing folder structure
2. Use consistent naming conventions
3. Include proper descriptions
4. Add auto-extraction for relevant IDs
5. Include error handling tests

## Version History

- **v2.0.0**: Added Stripe integration endpoints and enhanced testing
- **v1.0.0**: Initial subscription module endpoints

This collection provides comprehensive testing coverage for the entire subscription module with Stripe integration, making it easy to develop, test, and maintain the subscription system.
