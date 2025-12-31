import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

/**
 * Swagger decorator for GET /deployments/:deploymentId/logs - Get deployment logs
 */
export function ApiGetDeploymentLogs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get deployment logs',
      description:
        'Retrieves the logs for a specific deployment from the GitHub Actions workflow run.',
    }),
    ApiParam({
      name: 'deploymentId',
      type: String,
      description: 'The unique identifier of the deployment',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiResponse({
      status: 200,
      description: 'Deployment logs retrieved successfully',
      schema: {
        type: 'object',
        properties: {
          logs: {
            type: 'string',
            description: 'The deployment logs content',
          },
          downloadUrl: {
            type: 'string',
            description: 'URL to download the full logs archive',
          },
        },
      },
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - Not authorized to access this deployment',
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - Deployment or logs not found',
    }),
  );
}
