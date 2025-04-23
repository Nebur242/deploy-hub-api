# Deployment Module

## Overview

The Deployment Module is a NestJS-based system that manages deployments to GitHub Actions-backed environments. It supports multiple environments, GitHub account rotation, and deployment retries, providing a robust continuous delivery solution.

## Features

- **Multiple Environments**: Support for production and preview deployments
- **GitHub Integration**: Seamless deployments through GitHub Actions workflows
- **Round-Robin Account Rotation**: Distributes deployments across multiple GitHub accounts
- **Retry Mechanism**: Automatic retry with different accounts for failed deployments
- **Deployment Logging**: Comprehensive logging of deployment processes
- **Status Tracking**: Real-time status updates for deployments

## Prerequisites

- Node.js v16+
- NestJS v8+
- PostgreSQL database with TypeORM
- GitHub OAuth tokens with workflow dispatch permissions

## Installation

1. Include the module in your NestJS application:

```typescript
import { DeploymentModule } from './deployment/deployment.module';

@Module({
  imports: [
    // ...other imports
    TypeOrmModule.forRoot({
      // Database configuration
    }),
    DeploymentModule,
  ],
})
export class AppModule {}
```

2. Ensure the required database tables are created (either via TypeORM synchronization or migrations).

3. Configure GitHub accounts with proper repository access and workflow files.

## Configuration

The module relies on project configurations that include GitHub account details:

```typescript
// Example project configuration with GitHub accounts
const projectConfig = {
  id: 'config-uuid',
  projectId: 'project-uuid',
  name: 'Production Config',
  githubAccounts: [
    {
      username: 'github-user-1',
      accessToken: 'encrypted-token-1',
      repository: 'org/deployment-repo-1',
      workflowFile: '.github/workflows/deploy.yml',
    },
    {
      username: 'github-user-2',
      accessToken: 'encrypted-token-2',
      repository: 'org/deployment-repo-2',
      workflowFile: '.github/workflows/deploy.yml',
    },
  ],
  // Other configuration options
};
```

## API Endpoints

### Create Deployment

```
POST /deployments
```

Creates a new deployment for a project.

**Request Body:**

```json
{
  "environment": "preview", // "preview" or "production"
  "branch": "main",
  "projectId": "uuid-of-project",
  "configurationId": "uuid-of-configuration",
  "environmentVariables": [
    {
      "key": "API_URL",
      "defaultValue": "https://api.example.com"
    }
  ]
}
```

**Response:**

```json
{
  "id": "deployment-uuid",
  "ownerId": "user-uuid",
  "projectId": "project-uuid",
  "configurationId": "config-uuid",
  "environment": "preview",
  "branch": "main",
  "status": "pending",
  "environmentVariables": [...],
  "createdAt": "2023-01-01T00:00:00Z",
  "updatedAt": "2023-01-01T00:00:00Z"
}
```

### Get Deployment

```
GET /deployments/:deploymentId
```

**Response:**

```json
{
  "id": "deployment-uuid",
  "ownerId": "user-uuid",
  "projectId": "project-uuid",
  "configurationId": "config-uuid",
  "environment": "preview",
  "branch": "main",
  "status": "running",
  "workflowRunId": 12345678,
  "githubAccount": {
    "username": "github-user-1",
    "repository": "org/deployment-repo-1"
  },
  "environmentVariables": [...],
  "createdAt": "2023-01-01T00:00:00Z",
  "updatedAt": "2023-01-01T00:00:01Z"
}
```

### Retry Deployment

```
POST /deployments/:deploymentId/retry
```

Retries a failed deployment, potentially with a different GitHub account.

**Response:** Same as Get Deployment

### Get Project Deployments

```
GET /deployments/project/:projectId
```

**Response:**

```json
[
  {
    "id": "deployment-uuid-1",
    "status": "success",
    "environment": "production",
    "deploymentUrl": "https://example.vercel.app",
    "createdAt": "2023-01-01T00:00:00Z",
    ...
  },
  {
    "id": "deployment-uuid-2",
    "status": "failed",
    "environment": "preview",
    "errorMessage": "Workflow failed",
    "createdAt": "2023-01-02T00:00:00Z",
    ...
  }
]
```

### Get Deployment Logs

```
GET /deployments/:deploymentId/logs
```

**Response:**

```json
{
  "logs": "Workflow log output from GitHub Actions..."
}
```

## GitHub Workflow Requirements

For the deployment system to work properly, GitHub repositories need workflows that:

1. Accept workflow dispatch events
2. Have inputs for branch, environment, and environment variables
3. Report deployment URLs in a specific format for extraction:
   ```
   🔗 Deployment URL: https://deployment-url.example.com
   ```

Example workflow file:

```yaml
name: Deploy to Vercel

on:
  workflow_dispatch:
    inputs:
      branch:
        description: 'Branch to deploy'
        required: true
      environment:
        description: 'Deployment environment'
        required: true
      deployment_id:
        description: 'Deployment tracking ID'
        required: true
      # Additional environment variable inputs

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          ref: ${{ github.event.inputs.branch }}

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '16'

      - name: Install dependencies
        run: npm ci

      - name: Deploy to Vercel
        run: |
          # Deployment commands
          echo "🔗 Deployment URL: https://example-${{ github.event.inputs.environment }}.vercel.app"
```

## Authentication and Permissions

All API endpoints require authenticated users. Users can only access:

- Their own deployments
- Deployments for projects they own

## Error Handling

The module handles various error cases:

- Missing GitHub accounts
- Failed workflow triggers
- Permission issues
- Workflow execution failures

All errors are properly logged and returned with appropriate status codes.

## Deployment Status Lifecycle

1. **pending**: Initial state after creation
2. **running**: GitHub workflow triggered and running
3. **success**: Deployment completed successfully
4. **failed**: Deployment failed (with error message)
5. **canceled**: Deployment was canceled

## Round-Robin Algorithm

The module implements a round-robin algorithm to distribute deployments across available GitHub accounts:

1. Retrieves recent deployments
2. Identifies the last used account
3. Selects the next account in sequence
4. On failures, tries the next account in line

## Security Considerations

- GitHub tokens are encrypted at rest
- Tokens are decrypted only when needed for GitHub API calls
- API endpoints enforce ownership validation
- Environment variables are passed securely to GitHub workflows

## Contributing

When contributing to this module:

1. Ensure all new functionality has proper tests
2. Maintain the round-robin logic for account selection
3. Follow the error handling patterns for consistent responses
4. Update database entities when adding new fields

## License

This module is part of the main application's license agreement.
