# Deployment Module

## Overview

The Deployment Module manages the deployment process for projects in the Deploy Hub API. This module provides functionality for deploying projects to various environments, tracking deployment history, and integrating with external deployment services.

## Features

- Project deployment to multiple environments
- Deployment history tracking
- Deployment status monitoring
- Webhook integration for deployment events
- License-based deployment restrictions

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

## Controllers

### DeploymentController

Provides REST endpoints for managing deployments:

- `POST /deployments` - Create a new deployment
- `GET /deployments` - Get all deployments with filtering
- `GET /deployments/:id` - Get a specific deployment
- `PATCH /deployments/:id` - Update a deployment status
- `DELETE /deployments/:id` - Cancel a deployment

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

## License Validation

The module ensures that deployments respect license restrictions:

- Verifies active licenses before deployment
- Enforces deployment count limits based on license
- Restricts environment access based on license tier

## Error Handling

The module includes error handling for:

- Deployment failures
- License validation issues
- Provider integration errors
- Invalid deployment configurations
