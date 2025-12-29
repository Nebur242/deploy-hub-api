import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

/**
 * Swagger decorator for POST /deployments/:deploymentId/cancel - Cancel a deployment
 */
export function ApiCancelDeployment() {
  return applyDecorators(
    ApiOperation({
      summary: 'Cancel a running or pending deployment',
      description:
        'Cancels a deployment that is currently running or pending. Only the deployment owner can cancel.',
    }),
    ApiParam({
      name: 'deploymentId',
      type: String,
      description: 'The unique identifier of the deployment to cancel',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'Deployment cancellation result',
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - Cannot cancel deployment or not authorized',
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - Deployment not found',
    }),
  );
}
