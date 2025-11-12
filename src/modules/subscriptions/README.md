# Subscription Module

The Subscription Module provides a complete subscription management system for platform administrators (users who configure projects). It supports monthly and annual billing cycles with configurable features and limits.

## Overview

The subscription system allows:

- **Admin users** to purchase subscriptions for platform access
- **Flexible pricing** with monthly ($20/month) and annual ($199/year) options
- **Feature-based access control** (unlimited projects, deployments, custom domains, etc.)
- **Usage limits enforcement** based on subscription tiers
- **Subscription lifecycle management** (create, cancel, renew)

## Architecture

### Entities

#### 1. SubscriptionPlan

Defines available subscription plans with pricing and features.

**Key Fields:**

- `name`: Plan name (e.g., "Pro Monthly", "Enterprise Annual")
- `price`: Subscription price
- `currency`: Currency (USD, EUR, etc.)
- `type`: MONTHLY or ANNUAL
- `maxProjects`: Maximum projects (0 = unlimited)
- `maxDeployments`: Maximum deployments (0 = unlimited)
- `maxTeamMembers`: Maximum team members (0 = unlimited)
- `features`: Array of included features
- `popular`: Whether to highlight this plan
- `stripeProductId`/`stripePriceId`: Payment integration

#### 2. UserSubscription

Tracks user subscriptions and their status.

**Key Fields:**

- `userId`: Reference to the user
- `planId`: Reference to the subscription plan
- `status`: ACTIVE, CANCELLED, PAST_DUE, etc.
- `startDate`/`endDate`: Subscription period
- `autoRenew`: Whether subscription auto-renews
- `stripeSubscriptionId`: Payment system reference

### Services

#### 1. SubscriptionPlanService

- Create/update/delete subscription plans (Admin only)
- Get active plans for public display
- Filter and search plans
- Plan statistics

#### 2. UserSubscriptionService

- Create subscriptions for users
- Get current subscription and limits
- Cancel subscriptions
- Subscription history
- Usage validation

### Controllers

#### 1. SubscriptionPlanController

- **Admin endpoints**: CRUD operations for plans
- **Public endpoints**: List active plans
- **Statistics**: Plan usage analytics

#### 2. UserSubscriptionController

- **User endpoints**: Subscribe, view current plan, cancel
- **Admin endpoints**: View all subscriptions with filtering

## API Endpoints

### Public Endpoints (No Auth Required)

```
GET /api/v1/subscription-plans/public
```

### User Endpoints (Auth Required)

```
POST   /api/v1/user-subscriptions              # Subscribe to a plan
GET    /api/v1/user-subscriptions/current      # Get current subscription
GET    /api/v1/user-subscriptions/limits       # Get usage limits
GET    /api/v1/user-subscriptions/history      # Subscription history
DELETE /api/v1/user-subscriptions/:id/cancel   # Cancel subscription
```

### Admin Endpoints (Admin Role Required)

```
POST   /api/v1/subscription-plans              # Create plan
GET    /api/v1/subscription-plans              # List all plans
GET    /api/v1/subscription-plans/:id          # Get plan details
PATCH  /api/v1/subscription-plans/:id          # Update plan
DELETE /api/v1/subscription-plans/:id          # Delete plan
GET    /api/v1/subscription-plans/statistics   # Plan statistics

GET    /api/v1/user-subscriptions/admin/all    # All subscriptions
```

## Usage Examples

### 1. Create Subscription Plans (Admin)

```typescript
// Create monthly plan
POST /api/v1/subscription-plans
{
  "name": "Pro Monthly",
  "description": "Professional plan with unlimited projects",
  "price": 20,
  "currency": "USD",
  "type": "monthly",
  "maxProjects": 0,  // unlimited
  "maxDeployments": 0,  // unlimited
  "maxTeamMembers": 5,
  "features": [
    "unlimited_projects",
    "unlimited_deployments",
    "custom_domains",
    "priority_support"
  ],
  "popular": true
}

// Create annual plan
POST /api/v1/subscription-plans
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
  ]
}
```

### 2. User Subscribes to a Plan

```typescript
POST /api/v1/user-subscriptions
{
  "planId": "plan-uuid-here",
  "paymentMethodId": "pm_stripe_payment_method",
  "autoRenew": true
}
```

### 3. Check User's Subscription Limits

```typescript
GET /api/v1/user-subscriptions/limits

// Response:
{
  "hasActiveSubscription": true,
  "maxProjects": 0,  // unlimited
  "maxDeployments": 0,  // unlimited
  "maxTeamMembers": 5,
  "features": ["unlimited_projects", "custom_domains"],
  "planName": "Pro Monthly",
  "planType": "monthly"
}
```

### 4. Integration with Other Modules

The subscription module can be integrated with other parts of your system:

#### Project Creation Validation

```typescript
// In project service
const limits = await userSubscriptionService.getSubscriptionLimits(userId);
const projectCount = await projectService.getUserProjectCount(userId);

if (limits.maxProjects > 0 && projectCount >= limits.maxProjects) {
  throw new ForbiddenException('Project limit reached for your subscription');
}
```

#### Deployment Validation

```typescript
// In deployment service
const limits = await userSubscriptionService.getSubscriptionLimits(userId);
const deploymentCount = await deploymentService.getUserDeploymentCount(userId);

if (limits.maxDeployments > 0 && deploymentCount >= limits.maxDeployments) {
  throw new ForbiddenException('Deployment limit reached for your subscription');
}
```

## Database Migration

To add the subscription tables to your database, you'll need to run migrations:

```sql
-- Create subscription_plans table
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  max_projects INTEGER DEFAULT 0,
  max_deployments INTEGER DEFAULT 0,
  max_team_members INTEGER DEFAULT 0,
  features JSONB DEFAULT '[]',
  popular BOOLEAN DEFAULT false,
  stripe_product_id VARCHAR(255),
  stripe_price_id VARCHAR(255),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create user_subscriptions table
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP,
  trial_end_date TIMESTAMP,
  cancelled_at TIMESTAMP,
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  metadata JSONB,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_subscription_plans_status ON subscription_plans(status);
CREATE INDEX idx_subscription_plans_type ON subscription_plans(type);
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status);
```

## Features Enum

The `SubscriptionFeature` enum defines available features:

```typescript
export enum SubscriptionFeature {
  UNLIMITED_PROJECTS = 'unlimited_projects',
  UNLIMITED_DEPLOYMENTS = 'unlimited_deployments',
  CUSTOM_DOMAINS = 'custom_domains',
  ADVANCED_ANALYTICS = 'advanced_analytics',
  PRIORITY_SUPPORT = 'priority_support',
  API_ACCESS = 'api_access',
  TEAM_COLLABORATION = 'team_collaboration',
  WHITE_LABEL = 'white_label',
}
```

## Sample Pricing Tiers

Here are some example subscription plans you might create:

### Free Tier (Built-in limits)

- 1 project
- 3 deployments
- 1 team member
- Basic features

### Pro Monthly - $20/month

- Unlimited projects
- Unlimited deployments
- 5 team members
- Custom domains
- Priority support

### Pro Annual - $199/year

- Everything in Pro Monthly
- Advanced analytics
- API access
- 17% discount vs monthly

### Enterprise - Custom pricing

- Everything in Pro
- Unlimited team members
- White-label options
- Dedicated support

## Documentation

### Implementation Guides

- [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - Detailed implementation guide
- [FREE_TIER_IMPLEMENTATION.md](./FREE_TIER_IMPLEMENTATION.md) - Free tier auto-assignment details
- [UPGRADE_FEATURES.md](./UPGRADE_FEATURES.md) - Subscription upgrade functionality
- [STRIPE_INTEGRATION.md](./STRIPE_INTEGRATION.md) - Complete Stripe integration guide

### Frontend Integration

- [FRONTEND_INTEGRATION.md](./FRONTEND_INTEGRATION.md) - Complete frontend workflow implementation
- [QUICK_FRONTEND_GUIDE.md](./QUICK_FRONTEND_GUIDE.md) - Quick integration guide for developers

### Testing

- [TESTING_GUIDE.md](./TESTING_GUIDE.md) - Comprehensive testing strategies and examples

### Related Documentation

- [../database/DATABASE_SEEDING.md](../database/DATABASE_SEEDING.md) - Database seeding documentation
- [../users/USER_SUBSCRIPTION_INTEGRATION.md](../users/USER_SUBSCRIPTION_INTEGRATION.md) - User module integration
- [../../postman/README.md](../../postman/README.md) - API testing with Postman

## Next Steps

1. **Add the module** to your main app module
2. **Run database migrations** to create the tables
3. **Create initial subscription plans** via admin API
4. **Integrate subscription checks** in project/deployment services
5. **Set up payment processing** with Stripe
6. **Add frontend components** for plan selection and management

The subscription module is now ready to handle your platform's subscription needs!
