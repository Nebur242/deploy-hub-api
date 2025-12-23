import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';
import { IPaginationOptions, Pagination } from 'nestjs-typeorm-paginate';

import { FilterLicenseDto } from '../dto/filter.dto';
import { License, LicenseStatus } from '../entities/license.entity';
import { LicenseService } from '../services/license.service';

@ApiTags('public/licenses')
@Controller('public/licenses')
export class PublicLicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get()
  @ApiOperation({ summary: 'Get all public license options' })
  @ApiResponse({
    status: 200,
    description: 'Returns a paginated list of public license options',
    type: License,
    isArray: true,
  })
  @ApiQuery({ name: 'search', required: false, description: 'Search term for name or description' })
  @ApiQuery({ name: 'currency', required: false, description: 'Filter by currency' })
  @ApiQuery({ name: 'project_id', required: false, description: 'Filter by project ID' })
  @ApiQuery({ name: 'sort_by', required: false, description: 'Field to sort by' })
  @ApiQuery({
    name: 'sort_direction',
    required: false,
    enum: ['ASC', 'DESC'],
    description: 'Sort direction',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  findAllPublic(@Query() filter: FilterLicenseDto): Promise<Pagination<License>> {
    const { page = 1, limit = 10, ...rest } = filter;

    const paginationOptions: IPaginationOptions = {
      page,
      limit,
      route: '/public/licenses',
    };

    // Force status to PUBLIC for this endpoint
    return this.licenseService.findAll(
      {
        ...rest,
        status: LicenseStatus.PUBLIC,
      },
      paginationOptions,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a public license option by ID' })
  @ApiResponse({ status: 200, description: 'Returns the license option' })
  @ApiResponse({ status: 404, description: 'License option not found or not public' })
  @ApiParam({ name: 'id', description: 'License ID' })
  async findOnePublic(@Param('id') id: string): Promise<License> {
    const license = await this.licenseService.findOne(id);

    // Verify the license is public
    if (license.status !== LicenseStatus.PUBLIC) {
      throw new NotFoundException(`License option with ID ${id} not found or is not public`);
    }

    return license;
  }
}
