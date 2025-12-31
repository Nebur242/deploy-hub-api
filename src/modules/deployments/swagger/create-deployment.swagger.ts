import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';

import { CreateDeploymentDto } from '../dto/create-deployment.dto';
import { Deployment } from '../entities/deployment.entity';

/**
 * Swagger decorator for POST /deployments - Create a new deployment
 */
export function ApiCreateDeployment() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a new deployment',
      description:
        'Creates a new deployment for a project. Handles provider-specific setup (Vercel, Netlify, GitHub Actions) and validates license/subscription limits.',
    }),
    ApiBody({
      type: CreateDeploymentDto,
      description: 'Deployment creation payload',
    }),
    ApiResponse({
      status: 201,
      description: 'Deployment created successfully',
      type: Deployment,
    }),
    ApiResponse({
      status: 400,
      description: 'Bad request - Invalid input or provider setup failed',
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - License limits exceeded or no active license',
    }),
    ApiResponse({
      status: 404,
      description: 'Not found - Project, configuration, or license not found',
    }),
  );
}
