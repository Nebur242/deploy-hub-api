import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin, Authenticated } from '@app/core/guards/roles-auth.guard';
import { CreateOrderDto } from '@app/modules/payment/dto';
import { OrderService } from '@app/modules/payment/services/order.service';
import { User } from '@app/modules/users/entities/user.entity';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Inject,
  forwardRef,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { IPaginationOptions } from 'nestjs-typeorm-paginate';

import { CreateLicenseOptionDto } from '../dto/create-license-option.dto';
import { FilterLicenseDto } from '../dto/filter.dto';
import { UpdateLicenseOptionDto } from '../dto/update-license-option.dto';
import { LicenseOptionService } from '../services/license-option.service';

@ApiTags('licenses')
@ApiBearerAuth()
@Controller('licenses')
export class LicenseOptionController {
  constructor(
    private readonly licenseService: LicenseOptionService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) {}

  @Post()
  @Admin()
  @ApiOperation({ summary: 'Create a new license option for a project' })
  @ApiResponse({ status: 201, description: 'License option successfully created' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  create(@CurrentUser() user: User, @Body() createLicenseDto: CreateLicenseOptionDto) {
    return this.licenseService.create(user, createLicenseDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all license options with filtering and sorting' })
  @ApiResponse({ status: 200, description: 'Returns a list of license options' })
  @ApiQuery({ name: 'search', required: false, description: 'Search term for name or description' })
  @ApiQuery({ name: 'currency', required: false, description: 'Filter by currency' })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Field to sort by' })
  @ApiQuery({
    name: 'sortDirection',
    required: false,
    enum: ['ASC', 'DESC'],
    description: 'Sort direction',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (1-based)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @Authenticated()
  findAll(@Query() filter: FilterLicenseDto, @CurrentUser() user: User) {
    const { page = 1, limit = 10, ...rest } = filter;
    const paginationOptions: IPaginationOptions = {
      page,
      limit,
      route: '/licenses',
    };

    return this.licenseService.findAll(
      {
        ...rest,
        ownerId: user.id,
      },
      paginationOptions,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a license option by ID' })
  @ApiResponse({ status: 200, description: 'Returns the license option' })
  @ApiResponse({ status: 404, description: 'License option not found' })
  @ApiParam({ name: 'id', description: 'License option ID' })
  findOne(@Param('id') id: string) {
    return this.licenseService.findOne(id);
  }

  @Patch(':id')
  @Admin()
  @ApiOperation({ summary: 'Update a license option' })
  @ApiResponse({ status: 200, description: 'License option successfully updated' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'License option not found' })
  @ApiParam({ name: 'id', description: 'License option ID' })
  update(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() updateLicenseDto: UpdateLicenseOptionDto,
  ) {
    return this.licenseService.update(id, user.id, updateLicenseDto);
  }

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Delete a license option' })
  @ApiResponse({ status: 200, description: 'License option successfully deleted' })
  @ApiResponse({ status: 404, description: 'License option not found' })
  @ApiParam({ name: 'id', description: 'License option ID' })
  remove(@CurrentUser() user: User, @Param('id') id: string) {
    return this.licenseService.remove(id, user.id);
  }

  @Post(':id/purchase')
  @ApiOperation({ summary: 'Purchase a license' })
  @ApiResponse({ status: 201, description: 'License purchase initiated' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'License option not found' })
  @ApiParam({ name: 'id', description: 'License option ID' })
  @Authenticated()
  purchase(
    @CurrentUser() user: User,
    @Param('id') id: string,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    // Create a simple order for the license
    const dto: CreateOrderDto = {
      ...createOrderDto,
      licenseId: id,
    };
    return this.orderService.create(user.id, dto);
  }
}
