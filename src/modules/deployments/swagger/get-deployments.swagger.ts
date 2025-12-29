import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

/**
 * Swagger decorator for GET /deployments - Get paginated deployments with filters
 */
export function ApiGetDeployments() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get deployments with pagination and filters',
      description:
        'Retrieves a paginated list of deployments for the authenticated user with optional filtering.',
    }),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      description: 'Page number (default: 1)',
      example: 1,
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Number of items per page (default: 10)',
      example: 10,
    }),
    ApiQuery({
      name: 'projectId',
      required: true,
      type: String,
      description: 'Filter by project ID',
      example: '123e4567-e89b-12d3-a456-426614174000',
    }),
    ApiQuery({
      name: 'ownerId',
      required: false,
      type: String,
      description: 'Filter by owner ID',
    }),
    ApiQuery({
      name: 'environment',
      required: false,
      type: String,
      description: 'Filter by deployment environment (e.g., production, staging, development)',
    }),
    ApiQuery({
      name: 'status',
      required: false,
      type: String,
      description: 'Filter by deployment status (e.g., pending, running, success, failed)',
    }),
    ApiQuery({
      name: 'branch',
      required: false,
      type: String,
      description: 'Filter by Git branch name',
    }),
    ApiResponse({
      status: 200,
      description: 'Return paginated deployments',
      schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/Deployment' },
          },
          meta: {
            type: 'object',
            properties: {
              itemCount: { type: 'number' },
              totalItems: { type: 'number' },
              itemsPerPage: { type: 'number' },
              totalPages: { type: 'number' },
              currentPage: { type: 'number' },
            },
          },
        },
      },
    }),
    ApiResponse({
      status: 403,
      description: 'Forbidden - Project not found',
    }),
  );
}
