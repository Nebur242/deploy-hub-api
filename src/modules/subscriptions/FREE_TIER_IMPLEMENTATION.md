# Free Tier Auto-Assignment Implementation

## Overview

Added automatic free tier subscription assignment to new users, providing a seamless onboarding experience and clear upgrade path to paid plans.

## Changes Made

### 1. Subscription Plans

Added a new "Free Tier" plan to the seeder with the following characteristics:

- **Name**: Free Tier
- **Price**: $0
- **Type**: Monthly (doesn't auto-renew)
- **Limits**:
  - 1 project maximum
  - 3 deployments maximum
  - 1 team member
- **Features**: Basic support only
- **Sort Order**: 0 (appears first in plan lists)

### 2. Enhanced Services

#### SubscriptionSeederService

- Added `getFreeTierPlan()` method to retrieve the free tier plan
- Free tier plan is created automatically when seeding initial plans

#### UserSubscriptionService

- Added `assignFreeTierToUser(user: User)` method for automatic assignment
- Checks if user already has a subscription before creating
- Creates free tier subscription with:
  - Active status
  - No expiration date (`endDate: undefined`)
  - No auto-renewal
  - Immediate activation

### 3. Module Updates

- Added `SubscriptionSeederService` to providers and exports in `SubscriptionsModule`
- Services can now inject and use the seeder service

## Implementation Details

### Free Tier Characteristics

```typescript
{
  name: 'Free Tier',
  description: 'Perfect for getting started with basic project deployment',
  price: 0,
  currency: Currency.USD,
  type: SubscriptionPlanType.MONTHLY,
  status: SubscriptionPlanStatus.ACTIVE,
  maxProjects: 1,
  maxDeployments: 3,
  maxTeamMembers: 1,
  features: [SubscriptionFeature.PRIORITY_SUPPORT],
  popular: false,
  sortOrder: 0,
}
```

### Auto-Assignment Flow

1. New user registers/signs up
2. Call `userSubscriptionService.assignFreeTierToUser(user)`
3. Service checks if user already has a subscription
4. If not, retrieves free tier plan from seeder service
5. Creates new subscription with free tier plan
6. User immediately has access to free tier limits

## Usage Example

```typescript
// In user registration/onboarding service
async createUser(userData: CreateUserDto) {
  const user = await this.userService.create(userData);

  // Automatically assign free tier subscription
  await this.userSubscriptionService.assignFreeTierToUser(user);

  return user;
}

// Users can now immediately start using the platform with free tier limits
const canCreateProject = await this.userSubscriptionService.canPerformAction(
  user.id,
  'create_project'
); // Returns true for free tier users (up to 1 project)
```

## Benefits

1. **Seamless Onboarding**: Users automatically get access to platform features
2. **Clear Upgrade Path**: When they hit limits, they're prompted to upgrade
3. **No Manual Assignment**: Automatic process reduces administrative overhead
4. **Consistent Experience**: All users have a subscription (free or paid)
5. **Revenue Generation**: Natural conversion funnel from free to paid

## Next Steps

1. **User Registration Integration**: Add free tier assignment to user creation flow
2. **Usage Tracking**: Implement actual usage counting vs limits
3. **Upgrade Prompts**: Add UI notifications when approaching limits
4. **Analytics**: Track free tier usage and conversion rates
5. **Onboarding Flow**: Create guided experience for new free tier users

## Testing

To test the free tier assignment:

1. Run database migrations and seed data
2. Create a new user
3. Call `assignFreeTierToUser(user)`
4. Verify user has active free tier subscription
5. Test limit enforcement in project/deployment creation

The free tier auto-assignment is now ready for integration into the user registration flow.
