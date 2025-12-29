import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

import { RedeployDeploymentDto } from '../dto/redeploy-deployment.dto';
import { Deployment } from '../entities/deployment.entity';

/**
 * Swagger decorator for POST /deployments/:deploymentId/redeploy - Redeploy an existing deployment
 */
export function ApiRedeployDeployment() {
  return applyDecorators(
    ApiOperation({
      summary: 'Redeploy an existing deployment with optional overrides',
      description:
        'Creates a new deployment based on an existing one, optionally overriding environment, branch, or environment variables.',
    }),
    ApiParam({
      name: 'deploymentId',
      type: String,
      description: 'The unique identifier of the deployment to redeploy',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiBody({
      type: RedeployDeploymentDto,
      description: 'Optional overrides for the redeployment',
    }),
    ApiResponse({
      status: 201,
      description: 'Redeployment created successfully',
      type: Deployment,
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - Invalid input or license limits exceeded',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - Not authorized to redeploy this deployment',
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - Original deployment not found',
    }),
  );
}
