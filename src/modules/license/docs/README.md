# Licenses Module

## Overview

The Licenses Module is responsible for managing license options, user licenses, and license verification within the Deploy Hub API. This module enables the creation of different license types with varying features, durations, and pricing, as well as the verification of user license status.

## Features

- License option management (creation, update, deletion)
- License purchase integration with Payment module
- Active license verification
- Support for different license durations and features
- Project-specific license association

## Entities

### LicenseOption

The `LicenseOption` entity represents a type of license that can be purchased. It contains:

- Name and description
- Price and currency
- Duration in days (for time-limited licenses)
- Features included in this license
- Deployment limit
- Associated projects

### UserLicense

The `UserLicense` entity represents a license assigned to a specific user. It is created when a payment is successfully processed. It contains:

- Owner (user who owns the license)
- License ID (reference to the purchased license)
- Expiration date
- Active status
- Deployment count and limit
- List of deployments
- Trial status
- Metadata (order and payment references)

## Controllers

### LicenseOptionController

Provides REST endpoints for managing license options:

- `POST /licenses` - Create a new license option (admin only)
- `GET /licenses` - Get all license options with filtering and pagination
- `GET /licenses/:id` - Get a specific license option
- `PATCH /licenses/:id` - Update a license option (admin only)
- `DELETE /licenses/:id` - Delete a license option (admin only)
- `POST /licenses/:id/purchase` - Purchase a license option

### UserLicenseController

Provides REST endpoints for managing user licenses:

- `GET /user-licenses` - Get all user licenses for the current user with pagination
- `GET /user-licenses/:id` - Get a specific user license by ID
- `GET /user-licenses/active` - Get all active licenses for the current user
- `GET /user-licenses/active-licenses` - Get all active user licenses (UserLicense entities) for the current user
- `GET /user-licenses/has-active` - Check if the user has an active license
- `GET /user-licenses/active/:licenseId` - Get a specific active license for the current user
- `GET /user-licenses/admin/all` - Admin endpoint to get all user licenses with filtering and pagination
- `GET /user-licenses/admin/active` - Admin endpoint to get all active licenses for any user
- `GET /user-licenses/admin/has-active` - Admin endpoint to check if any user has an active license

## Services

### LicenseOptionService

Manages license options and provides methods for:

- Creating license options
- Finding and filtering license options
- Updating and deleting license options
- Associating licenses with projects

### UserLicenseService

Manages user licenses and provides methods for:

- Checking if a user has an active license
- Getting all active licenses for a user
- Getting a specific active license for a user

## Integration with Payment Module

The Licenses Module is integrated with the Payment Module to enable license purchases:

1. Users browse available license options
2. When a user chooses to purchase a license, an order is created via the Payment Module
3. After successful payment, the license becomes active for the user
4. The system tracks license status, expiration, and features

## Usage

### Creating a License Option (Admin)

```typescript
// Example: Creating a new license option
const createLicenseDto: CreateLicenseOptionDto = {
  name: 'Enterprise License',
  description: 'Full access to all features',
  price: 99.99,
  currency: Currency.USD,
  deploymentLimit: 10,
  duration: 365, // Valid for 1 year
  features: ['Premium Support', 'CI/CD Integration', 'Custom Domain'],
};

const licenseOption = await licenseOptionService.create(adminId, createLicenseDto);
```

### Checking License Status

```typescript
// Example: Checking if a user has an active license for a project
const hasLicense = await userLicenseService.hasActiveLicense(userId, projectId);
```

### Purchasing a License

```typescript
// Example: Purchasing a license
const order = await orderService.create(userId, { licenseId: licenseOptionId });
```

## License Verification Flow

1. When a user attempts to access a feature that requires a license:

   - The system checks if they have an active license for the project
   - The system verifies that the license hasn't expired
   - The system confirms that the license includes the required feature

2. License status is determined by:
   - Payment status (completed)
   - License expiration date
   - License being marked as active

## Error Handling

The module includes error handling for various scenarios:

- License option not found
- Inactive or expired licenses
- Unauthorized access to admin operations
