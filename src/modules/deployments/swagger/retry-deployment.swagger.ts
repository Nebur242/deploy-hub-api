import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

import { Deployment } from '../entities/deployment.entity';

/**
 * Swagger decorator for POST /deployments/:deploymentId/retry - Retry a failed deployment
 */
export function ApiRetryDeployment() {
  return applyDecorators(
    ApiOperation({
      summary: 'Retry a failed deployment',
      description:
        'Retries a deployment that has previously failed. Only the deployment owner can retry.',
    }),
    ApiParam({
      name: 'deploymentId',
      type: String,
      description: 'The unique identifier of the deployment to retry',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'Deployment retry initiated successfully',
      type: Deployment,
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - Deployment cannot be retried in current state',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - Not authorized to retry this deployment',
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - Deployment not found',
    }),
  );
}
