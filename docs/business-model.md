# Deploy Hub - Business Model Understanding

## Overview

Deploy Hub is a **B2B2C marketplace platform** for software deployment licensing. It connects **Project Owners** (developers/businesses) with **End Users** (customers who purchase licenses).

---

## User Roles

### 1. Project Owner (Developer)

- Registers on the platform
- Subscribes to a plan (Free, Starter, Pro, Enterprise)
- Creates and configures **Projects**
- Creates **Licenses** for their projects with pricing and deployment limits
- Earns revenue when users purchase their licenses

### 2. End User (Customer)

- Browses the **Marketplace**
- Views projects and their available licenses
- Purchases licenses to deploy the project owner's software
- Uses deployments allocated by the purchased license

---

## Subscription Plans (For Project Owners)

| Plan           | Projects  | Total Deployments Pool | Price   |
| -------------- | --------- | ---------------------- | ------- |
| **Free**       | 1         | 10                     | $0/mo   |
| **Starter**    | 10        | 500                    | $19/mo  |
| **Pro**        | 50        | 2,000                  | $49/mo  |
| **Enterprise** | Unlimited | Unlimited              | $199/mo |

---

## Key Business Rules

### Deployment Pool System

1. **Owner's Subscription = Deployment Pool**

   - The owner's subscription determines the **total deployment pool** they can distribute
   - Example: A "Starter" plan owner has **500 deployments** to allocate across ALL their licenses

2. **License Deployment Allocation**

   - When creating a license, the owner assigns a `deployment_limit` from their pool
   - **Minimum 5 deployments per license** (to ensure meaningful value for customers)
   - The **sum of all license deployment limits** cannot exceed the owner's pool

3. **Example Scenario**

   ```
   Owner Plan: Starter (500 deployments pool)

   License A: 100 deployments → Pool remaining: 400
   License B: 50 deployments  → Pool remaining: 350
   License C: 200 deployments → Pool remaining: 150
   License D: 5 deployments   → Pool remaining: 145

   ❌ Cannot create License E with 200 deployments (only 145 available)
   ✅ Can create License E with 145 deployments or less
   ```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      PROJECT OWNER                               │
│  ┌──────────────┐                                               │
│  │ Subscription │ ──► max_deployments_per_month: 500            │
│  │   (Starter)  │                                               │
│  └──────────────┘                                               │
│         │                                                        │
│         ▼                                                        │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    DEPLOYMENT POOL                          ││
│  │                     500 total                               ││
│  └─────────────────────────────────────────────────────────────┘│
│         │                                                        │
│         ├──────────────┬──────────────┬──────────────┐          │
│         ▼              ▼              ▼              ▼          │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │License A │   │License B │   │License C │   │License D │     │
│  │ 100 dep  │   │  50 dep  │   │ 200 dep  │   │  50 dep  │     │
│  │  $29/mo  │   │  $19/mo  │   │  $99/mo  │   │  $49/mo  │     │
│  └──────────┘   └──────────┘   └──────────┘   └──────────┘     │
│                                                                  │
│  Remaining Pool: 500 - (100+50+200+50) = 100 deployments        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MARKETPLACE                                 │
│                                                                  │
│  End Users browse and purchase licenses                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       END USER                                   │
│                                                                  │
│  Purchased License B → Can deploy 50 times                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Validation Rules to Implement

### When Creating a License:

```typescript
// 1. Check minimum deployment limit
if (dto.deployment_limit < 5) {
  throw new BadRequestException('Minimum deployment limit per license is 5');
}

// 2. Calculate already allocated deployments
const allocatedDeployments = await this.calculateAllocatedDeployments(ownerId);

// 3. Get owner's subscription pool
const subscription = await this.subscriptionService.getSubscription(ownerId);
const availablePool = subscription.max_deployments_per_month - allocatedDeployments;

// 4. Check if enough pool available
if (dto.deployment_limit > availablePool) {
  throw new BadRequestException(
    `Insufficient deployment pool. Available: ${availablePool}, Requested: ${dto.deployment_limit}`,
  );
}
```

### When Updating a License:

```typescript
// Recalculate available pool excluding current license
const allocatedWithoutCurrent = allocatedDeployments - currentLicense.deployment_limit;
const availablePool = subscription.max_deployments_per_month - allocatedWithoutCurrent;

if (dto.deployment_limit > availablePool) {
  throw new BadRequestException(`Cannot increase deployment limit. Available: ${availablePool}`);
}
```

### When Owner Downgrades Subscription:

```typescript
// Check if current allocations exceed new plan's pool
const allocatedDeployments = await this.calculateAllocatedDeployments(ownerId);
const newPlanPool = newPlan.maxDeploymentsPerMonth;

if (allocatedDeployments > newPlanPool) {
  throw new BadRequestException(
    `Cannot downgrade. You have ${allocatedDeployments} deployments allocated across licenses, ` +
      `but the new plan only allows ${newPlanPool}. Please reduce license limits first.`,
  );
}
```

---

## Database Changes Needed

### Subscription Entity

- `max_deployments_per_month` → Represents the owner's **deployment pool**
- Rename consideration: `deployment_pool` might be clearer

### License Entity

- `deployment_limit` → Deployments allocated to this license from owner's pool
- Already has minimum validation needed (set default to 5)

### New: Add a computed/cached field (optional for performance)

```typescript
// In Subscription entity
@Column({ default: 0 })
allocated_deployments: number; // Sum of all license deployment_limits
```

---

## API Endpoints Affected

| Endpoint                       | Change Needed                                       |
| ------------------------------ | --------------------------------------------------- |
| `POST /licenses`               | Add pool validation before creating                 |
| `PUT /licenses/:id`            | Add pool validation before updating                 |
| `POST /subscriptions/checkout` | Validate before downgrade                           |
| `GET /subscriptions`           | Return `allocated_deployments` and `available_pool` |

---

## Frontend Changes Needed

### Owner Dashboard

1. **Subscription Page**

   - Show: "Deployment Pool: 350/500 used"
   - Progress bar visualization

2. **Create License Form**

   - Show available pool
   - Enforce minimum 5 deployments
   - Show error if exceeding pool

3. **License List**
   - Show deployment allocation per license
   - Total allocated vs pool

---

## Questions to Clarify

1. **Per-month or Total?**

   - Are deployments **per month** (reset monthly) or **total** (never reset)?
   - Current assumption: Per month (based on field name `max_deployments_per_month`)

2. **What happens when a user's purchased license expires/runs out of deployments?**

   - Do they need to repurchase?
   - Can the owner "refill" deployments?

3. **Revenue split?**

   - Does the platform take a percentage of license sales?

4. **License duration vs deployments?**
   - Currently licenses have both `duration` (days) and `deployment_limit`
   - Which takes precedence for expiry?

---

## Summary

| Actor             | Has                                | Limits                                       |
| ----------------- | ---------------------------------- | -------------------------------------------- |
| **Platform**      | Subscription Plans                 | Sets max projects & deployment pool per plan |
| **Project Owner** | Subscription + Projects + Licenses | Distributes deployment pool across licenses  |
| **End User**      | Purchased Licenses                 | Uses deployments from purchased license      |

The key insight is that `max_deployments_per_month` in the subscription is a **pool to be distributed**, not direct usage by the owner.
