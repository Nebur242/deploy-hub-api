# Deployment Module

## Overview

The Deployment Module manages the deployment process for projects in the Deploy Hub API. This module provides functionality for deploying projects to various environments, tracking deployment history, and integrating with external deployment services.

## Features

- Project deployment to multiple environments
- Deployment history tracking
- Deployment status monitoring
- Webhook integration for deployment events
- License-based deployment restrictions
- Deployment count tracking and limits via UserLicense integration

## Entities

### Deployment

The `Deployment` entity represents a single deployment instance and contains:

- Project association
- Environment details (development, production, etc.)
- Deployment status
- Version information
- Timestamps (created, updated, completed)
- Configuration settings
- Logs and results

### UserLicense Integration

The Deployment Module integrates with the `UserLicense` entity from the Licenses Module for deployment tracking:

- License association
- Owner association
- Current deployment count (`count` field)
- Maximum allowed deployments (`maxDeployments` field)
- List of deployment IDs (`deployments` array)
- License status and expiration tracking

## Controllers

### DeploymentController

Provides REST endpoints for managing deployments:

- `POST /deployments` - Create a new deployment
- `GET /deployments` - Get all deployments with filtering
- `GET /deployments/:id` - Get a specific deployment
- `PATCH /deployments/:id` - Update a deployment status
- `DELETE /deployments/:id` - Cancel a deployment
- `GET /deployments/licenses` - Get user licenses with deployment tracking (replaces `/deployments/count`)
- `POST /deployments/:id/retry` - Retry a failed deployment
- `POST /deployments/:id/redeploy` - Redeploy an existing deployment with optional overrides
- `GET /deployments/:id/logs` - Get logs for a specific deployment

### WebhookController

Handles webhook callbacks from deployment services:

- `POST /deployments/webhook/:provider` - Receive deployment updates from providers

## Services

### DeploymentService

Manages the deployment process and provides methods for:

- Initiating deployments
- Tracking deployment status
- Verifying license permissions before deployment
- Managing deployment history
- Processing deployment results

## Integration Points

The Deployment Module integrates with:

- **Projects Module**: For access to project details and settings
- **Licenses Module**: For verifying deployment permissions
- **Users Module**: For deployment authorization

## Deployment Process Flow

1. **Initiation**: A deployment is requested for a project
2. **Validation**: License and permissions are verified
3. **Deployment**: The project is deployed to the target environment
4. **Monitoring**: Deployment status is tracked and updated
5. **Completion**: Final status and logs are recorded

## Usage

### Creating a Deployment

```typescript
// Example: Creating a new deployment
const createDeploymentDto: CreateDeploymentDto = {
  projectId: 'project-uuid',
  environment: 'production',
  version: '1.0.0',
  configuration: {
    buildCommand: 'npm run build',
    outputDirectory: 'dist',
  },
};

const deployment = await deploymentService.create(userId, createDeploymentDto);
```

### Getting Deployment Status

```typescript
// Example: Checking deployment status
const deployment = await deploymentService.findOne(deploymentId);
console.log(`Deployment status: ${deployment.status}`);
```

### Getting User Licenses with Deployment Tracking

```typescript
// Example: Getting user licenses with deployment information
const userLicenses = await deploymentService.getUserLicenses({
  page: 1,
  limit: 10,
  route: 'deployments/licenses',
});

console.log(`Total user licenses: ${userLicenses.meta.totalItems}`);
userLicenses.items.forEach(license => {
  console.log(`License ${license.id}: ${license.count}/${license.maxDeployments} deployments used`);
});
```

### Processing a Webhook Callback

```typescript
// Example: Handling a webhook update
await deploymentService.processWebhookUpdate(providerId, {
  deploymentId: 'deployment-uuid',
  status: 'completed',
  logs: ['Build successful', 'Deployment complete'],
  url: 'https://example.com',
});
```

### Redeploying an Existing Deployment

```typescript
// Example: Redeploy with same configuration
const redeployment = await deploymentService.redeployDeployment(
  'original-deployment-id',
  {}, // No overrides, use original configuration
  user,
);

// Example: Redeploy to different environment
const redeployment = await deploymentService.redeployDeployment(
  'original-deployment-id',
  {
    environment: 'production', // Override environment
    branch: 'release-v2.0', // Override branch
  },
  user,
);

// Example: Redeploy with updated environment variables
const redeployment = await deploymentService.redeployDeployment(
  'original-deployment-id',
  {
    environmentVariables: [
      {
        key: 'API_VERSION',
        defaultValue: 'v2',
        description: 'API version to use',
        isRequired: true,
        isSecret: false,
        type: 'text',
      },
    ],
  },
  user,
);
```

## License Validation

The module ensures that deployments respect license restrictions:

- Verifies active UserLicense before deployment
- Enforces deployment count limits based on UserLicense.maxDeployments
- Restricts environment access based on license tier
- Updates UserLicense.count when deployments are successful

## Error Handling

The module includes error handling for:

- Deployment failures
- License validation issues
- Provider integration errors
- Invalid deployment configurations

## UserLicense Integration

The deployment system now uses UserLicense entities for tracking deployment usage:

- **Validation**: Before deployment, checks if user has active UserLicense with available deployments
- **Tracking**: On successful deployment, increments UserLicense.count and adds deployment ID to UserLicense.deployments array
- **Limits**: Prevents deployment if UserLicense.count >= UserLicense.maxDeployments
- **Status**: Only active UserLicenses (active: true) are considered for deployment validation

### Deployment Limit Check Process

1. **User Authentication**: Verify user is authenticated
2. **License Lookup**: Find active UserLicense for the user
3. **Limit Validation**: Check if `count < maxDeployments`
4. **Expiration Check**: Verify license hasn't expired (if applicable)
5. **Deployment Creation**: Proceed with deployment if all checks pass
6. **Count Update**: Increment license count and update deployments array on success
