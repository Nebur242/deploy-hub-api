import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

import { Deployment } from '../entities/deployment.entity';

/**
 * Swagger decorator for GET /deployments/:deploymentId - Get a single deployment
 */
export function ApiGetDeployment() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get a deployment by ID',
      description: 'Retrieves detailed information about a specific deployment.',
    }),
    ApiParam({
      name: 'deploymentId',
      type: String,
      description: 'The unique identifier of the deployment',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'Deployment retrieved successfully',
      type: Deployment,
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - Not authorized to access this deployment',
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - Deployment not found',
    }),
  );
}
