import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

/**
 * Swagger decorator for GET /deployments/licenses - Get user licenses with deployment counts
 */
export function ApiGetUserLicenses() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get user licenses with pagination and filters',
      description:
        'Retrieves a paginated list of user licenses with deployment counts for the authenticated user.',
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
      name: 'licenseId',
      required: false,
      type: String,
      description: 'Filter by license ID',
    }),
    ApiQuery({
      name: 'createdFrom',
      required: false,
      type: String,
      description: 'Filter by created date (from) - ISO 8601 format',
      example: '2024-01-01T00:00:00Z',
    }),
    ApiQuery({
      name: 'createdTo',
      required: false,
      type: String,
      description: 'Filter by created date (to) - ISO 8601 format',
      example: '2024-12-31T23:59:59Z',
    }),
    ApiQuery({
      name: 'minCount',
      required: false,
      type: Number,
      description: 'Filter by minimum deployment count',
      example: 5,
    }),
    ApiResponse({
      status: 200,
      description: 'Return paginated user licenses',
      schema: {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/UserLicense' },
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
  );
}
