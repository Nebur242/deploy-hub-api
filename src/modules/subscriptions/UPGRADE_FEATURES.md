# Subscription Upgrade Features

This document outlines the comprehensive upgrade features implemented in the Subscription Module.

## Overview

The subscription upgrade system provides a robust set of features for managing subscription plan changes, including immediate upgrades, scheduled upgrades, pricing calculations, and analytics.

## Features

### 1. Immediate Upgrades

Users can immediately upgrade their subscription to a higher-tier plan:

- **Endpoint**: `PUT /user-subscriptions/upgrade/:planId`
- **Validation**: Ensures upgrade is to a higher-tier plan
- **Continuity**: Preserves subscription continuity with proper date calculations
- **Metadata**: Supports upgrade tracking with custom metadata

### 2. Upgrade Options

Get available upgrade options for the current user:

- **Endpoint**: `GET /user-subscriptions/upgrade-options`
- **Logic**: Returns only plans that are valid upgrades from current plan
- **Filtering**: Excludes current plan and invalid downgrade options

### 3. Upgrade Pricing

Calculate pricing information for potential upgrades:

- **Endpoint**: `GET /user-subscriptions/upgrade-pricing/:planId`
- **Features**:
  - Price difference calculation
  - Prorated amount for mid-cycle upgrades
  - Remaining days calculation
  - Upgrade validation

### 4. Scheduled Upgrades

Schedule upgrades for the next billing cycle:

- **Endpoint**: `POST /user-subscriptions/schedule-upgrade/:planId`
- **Benefits**: Avoid mid-cycle charges
- **Processing**: Automatic processing via cron job
- **Flexibility**: Cancel or modify scheduled upgrades

### 5. Downgrade Checking

Check if downgrade to a specific plan is allowed:

- **Endpoint**: `GET /user-subscriptions/can-downgrade/:planId`
- **Logic**: Allows downgrades to same or lower-priced plans
- **Use Case**: UI can show/hide downgrade options

### 6. Subscription Analytics

Comprehensive analytics for subscription history:

- **Endpoint**: `GET /user-subscriptions/analytics`
- **Metrics**:
  - Total spent
  - Upgrade history
  - Account age
  - Subscription count
  - Current status

### 7. Admin Features

#### Process Scheduled Upgrades

- **Endpoint**: `POST /user-subscriptions/admin/process-scheduled-upgrades`
- **Purpose**: Process all pending scheduled upgrades
- **Usage**: Called by cron jobs or manual admin trigger

## Upgrade Validation Logic

### Valid Upgrades

1. **Free to Paid**: Any free plan can upgrade to any paid plan
2. **Price-Based**: Higher price = higher tier
3. **Monthly to Annual**: Same price but annual billing
4. **Feature-Based**: More features = higher tier

### Invalid Upgrades

1. **Paid to Free**: Not allowed
2. **Same Plan**: Not allowed
3. **Lower Price**: Generally not allowed (use downgrade)
4. **Fewer Features**: Generally not allowed

## Proration Logic

When upgrading mid-cycle:

```typescript
const remainingDays = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
const totalDays = plan.type === 'MONTHLY' ? 30 : 365;
const unusedRatio = remainingDays / totalDays;
const proratedAmount = priceDifference * unusedRatio;
```

## Usage Examples

### Immediate Upgrade

```typescript
// Get upgrade options
const options = await fetch('/user-subscriptions/upgrade-options');

// Calculate pricing
const pricing = await fetch('/user-subscriptions/upgrade-pricing/plan-id');

// Perform upgrade
const result = await fetch('/user-subscriptions/upgrade/plan-id', {
  method: 'PUT',
  body: JSON.stringify({
    metadata: { source: 'dashboard', reason: 'more-features' },
  }),
});
```

### Scheduled Upgrade

```typescript
// Schedule for next billing cycle
const scheduled = await fetch('/user-subscriptions/schedule-upgrade/plan-id', {
  method: 'POST',
  body: JSON.stringify({
    metadata: { source: 'auto-renewal', reason: 'plan-change' },
  }),
});
```

## Database Schema Updates

### UserSubscription Metadata

The `metadata` field supports the following upgrade-related data:

```typescript
interface UpgradeMetadata {
  // When upgraded
  upgradedFrom?: string; // Previous plan ID
  upgradeDate?: string; // Upgrade timestamp
  upgradeReason?: string; // Reason for upgrade

  // Scheduled upgrades
  scheduledUpgrade?: {
    newPlanId: string;
    scheduledDate: string;
    metadata?: Record<string, unknown>;
  };

  // Custom metadata
  [key: string]: unknown;
}
```

## Error Handling

### Common Errors

1. **No Active Subscription**: 404 when trying to upgrade without subscription
2. **Invalid Plan**: 404 when target plan doesn't exist
3. **Invalid Upgrade**: 400 when upgrade validation fails
4. **Already Upgraded**: 400 when user already has target plan

### Error Responses

```typescript
{
  "statusCode": 400,
  "message": "Invalid upgrade: cannot downgrade to a lower-tier plan",
  "error": "Bad Request"
}
```

## Testing

### Postman Collection

The Postman collection includes all upgrade endpoints:

- Get Upgrade Options
- Upgrade Plan
- Get Upgrade Pricing
- Schedule Upgrade
- Get Analytics
- Can Downgrade
- Admin - Process Scheduled Upgrades

### Test Scenarios

1. **Happy Path**: Upgrade from free to paid
2. **Validation**: Attempt invalid downgrades
3. **Pricing**: Verify proration calculations
4. **Scheduling**: Test scheduled upgrade workflow
5. **Analytics**: Verify upgrade history tracking

## Integration Points

### With Projects/Deployments

Upgrades automatically affect:

- Project creation limits
- Deployment limits
- Feature availability

### With Users Module

- Auto-assignment of free tier to new users
- Upgrade notifications
- Account status updates

### With Payment System

Future integration points:

- Stripe webhooks
- Payment processing
- Invoice generation
- Refund handling

## Monitoring & Analytics

### Key Metrics

1. **Upgrade Rate**: % of users who upgrade
2. **Revenue Impact**: Revenue from upgrades
3. **Churn Reduction**: Upgrades vs cancellations
4. **Plan Popularity**: Most upgraded-to plans

### Logging

All upgrade events are logged with:

- User ID
- Previous plan
- New plan
- Upgrade type (immediate/scheduled)
- Metadata

## Future Enhancements

1. **Smart Recommendations**: AI-based plan suggestions
2. **A/B Testing**: Test different upgrade flows
3. **Promo Codes**: Discount codes for upgrades
4. **Trial Extensions**: Extended trials before upgrade
5. **Usage-Based Upgrades**: Automatic upgrades based on usage
6. **Bulk Upgrades**: Admin tool for bulk user upgrades

## Conclusion

The upgrade system provides a comprehensive, flexible, and user-friendly way to manage subscription plan changes while maintaining data integrity and business logic compliance.
