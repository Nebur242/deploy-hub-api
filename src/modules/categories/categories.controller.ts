import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin } from '@app/core/guards/roles-auth.guard';
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
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
  ApiQuery,
  ApiOkResponse,
} from '@nestjs/swagger';
import { Pagination } from 'nestjs-typeorm-paginate';

import { CategoryService } from './categories.service';
import {
  CreateCategoryDto,
  UpdateCategoryDto,
  CategoryResponseDto,
  CategoryFilterDto,
  CategoryTreeDto,
} from './dto/category.dto';
import { Category } from './entities/category.entity';

@ApiTags('categories')
@Controller('categories')
@Admin()
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new category' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The category has been successfully created.',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Validation error' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Category already exists' })
  create(
    @Body() createCategoryDto: CreateCategoryDto,
    @CurrentUser() user: User,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.create(createCategoryDto, user);
  }

  @Get()
  @ApiOperation({ summary: 'Get all categories' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of categories',
    type: [CategoryResponseDto],
  })
  @ApiQuery({ name: 'parentId', required: false, description: 'Filter by parent ID or "root"' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Include inactive categories',
  })
  findAll(
    @Query() filters: CategoryFilterDto,
    @CurrentUser() user: User,
  ): Promise<Pagination<Category>> {
    return this.categoryService.findAll({ ...filters, ownerId: user.id });
  }

  @Get('paginated')
  @ApiOperation({ summary: 'Get paginated categories' })
  @ApiOkResponse({
    description: 'Paginated list of categories',
    schema: {
      properties: {
        items: {
          type: 'array',
          items: { $ref: '#/components/schemas/CategoryResponseDto' },
        },
        meta: {
          type: 'object',
          properties: {
            totalItems: { type: 'number' },
            itemCount: { type: 'number' },
            itemsPerPage: { type: 'number' },
            totalPages: { type: 'number' },
            currentPage: { type: 'number' },
          },
        },
        links: {
          type: 'object',
          properties: {
            first: { type: 'string' },
            previous: { type: 'string' },
            next: { type: 'string' },
            last: { type: 'string' },
          },
        },
      },
    },
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page' })
  @ApiQuery({ name: 'parentId', required: false, description: 'Filter by parent ID or "root"' })
  @ApiQuery({ name: 'isActive', required: false, description: 'Filter by active status' })
  @ApiQuery({ name: 'search', required: false, description: 'Search by name' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Include inactive categories',
  })
  findAllPaginated(@Query() filters: CategoryFilterDto): Promise<Pagination<Category>> {
    const { page = 1, limit = 10, ...restFilters } = filters;
    return this.categoryService.findAllPaginated({ page, limit }, restFilters);
  }

  @Get('tree')
  @ApiOperation({ summary: 'Get category hierarchy tree' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Category hierarchy tree',
    type: [CategoryTreeDto],
  })
  @ApiQuery({ name: 'parentId', required: false, description: 'Root node for the tree' })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'Include inactive categories',
  })
  getTree(@Query() filters: CategoryFilterDto): Promise<CategoryTreeDto[]> {
    return this.categoryService.getCategoryTree(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The found category',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Category not found' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  findOne(@Param('id') id: string): Promise<CategoryResponseDto> {
    return this.categoryService.findOne(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get category by slug' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The found category',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Category not found' })
  @ApiParam({ name: 'slug', description: 'Category slug' })
  findBySlug(@Param('slug') slug: string): Promise<CategoryResponseDto> {
    return this.categoryService.findBySlug(slug);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update category' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The category has been successfully updated.',
    type: CategoryResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Category not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden resource' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Conflict with existing data' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  update(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @CurrentUser() user: User,
  ): Promise<CategoryResponseDto> {
    return this.categoryService.update(id, updateCategoryDto, user);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove category' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'The category has been successfully removed.',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Category not found' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Forbidden resource' })
  @ApiResponse({ status: HttpStatus.CONFLICT, description: 'Cannot delete category with children' })
  @ApiParam({ name: 'id', description: 'Category ID' })
  remove(@Param('id') id: string, @CurrentUser() user: User): Promise<void> {
    return this.categoryService.remove(id, user);
  }
}
