import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin, Authenticated } from '@app/core/guards/roles-auth.guard';
import { CreateOrderDto, FilterOrdersDto } from '@app/modules/order/dto';
import { OrderService } from '@app/modules/order/services/order.service';
import { StripeService } from '@app/modules/payment/services/stripe.service';
import { User } from '@app/modules/users/entities/user.entity';
import { LicensePeriod, OrderStatus } from '@app/shared/enums';
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
  ParseUUIDPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { IPaginationOptions } from 'nestjs-typeorm-paginate';

import { CheckoutLicenseDto } from '../dto/checkout-license.dto';
import { CreateLicenseDto } from '../dto/create-license.dto';
import { FilterLicenseDto } from '../dto/filter.dto';
import { UpdateLicenseDto } from '../dto/update-license.dto';
import { LicenseService } from '../services/license.service';

@ApiTags('licenses')
@ApiBearerAuth()
@Controller('licenses')
export class LicenseController {
  constructor(
    private readonly licenseService: LicenseService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
    @Inject(forwardRef(() => StripeService))
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @Admin()
  @ApiOperation({ summary: 'Create a new license option for a project' })
  @ApiResponse({ status: 201, description: 'License option successfully created' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiParam({ name: 'projectId', description: 'Project ID' })
  create(@CurrentUser() user: User, @Body() createLicenseDto: CreateLicenseDto) {
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
        owner_id: user.id,
      },
      paginationOptions,
    );
  }

  // ===== License Purchases/Orders Endpoints =====
  // These routes must be defined BEFORE the :id route to avoid route conflicts

  @Get('purchases')
  @Authenticated()
  @ApiOperation({ summary: 'Get all purchases/orders for licenses owned by the current user' })
  @ApiResponse({ status: 200, description: 'Returns paginated list of license purchases' })
  getPurchases(@CurrentUser() user: User, @Query() filter: FilterOrdersDto) {
    const { page = 1, limit = 10 } = filter;
    return this.orderService.findOrdersByOwner(user.id, filter, { page, limit });
  }

  @Get('purchases/:id')
  @Authenticated()
  @ApiOperation({ summary: 'Get a specific purchase/order by ID' })
  @ApiResponse({ status: 200, description: 'Returns purchase details' })
  @ApiResponse({ status: 404, description: 'Purchase not found' })
  @ApiParam({ name: 'id', description: 'Purchase/Order ID' })
  getPurchaseById(@CurrentUser() user: User, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.orderService.findOneByOwner(id, user.id);
  }

  @Post('purchases/:id/confirm')
  @Authenticated()
  @ApiOperation({ summary: 'Confirm a purchase/order' })
  @ApiResponse({ status: 200, description: 'Purchase confirmed' })
  @ApiResponse({ status: 404, description: 'Purchase not found' })
  @ApiParam({ name: 'id', description: 'Purchase/Order ID' })
  async confirmPurchase(@CurrentUser() user: User, @Param('id', new ParseUUIDPipe()) id: string) {
    // Verify ownership first
    await this.orderService.findOneByOwner(id, user.id);
    return this.orderService.updateStatus(id, OrderStatus.COMPLETED);
  }

  @Post('purchases/:id/cancel')
  @Authenticated()
  @ApiOperation({ summary: 'Cancel a purchase/order' })
  @ApiResponse({ status: 200, description: 'Purchase cancelled' })
  @ApiResponse({ status: 404, description: 'Purchase not found' })
  @ApiParam({ name: 'id', description: 'Purchase/Order ID' })
  async cancelPurchase(@CurrentUser() user: User, @Param('id', new ParseUUIDPipe()) id: string) {
    // Verify ownership first
    await this.orderService.findOneByOwner(id, user.id);
    return this.orderService.updateStatus(id, OrderStatus.CANCELLED);
  }

  // ===== License CRUD Endpoints =====

  @Get(':id')
  @ApiOperation({ summary: 'Get a license option by ID' })
  @ApiResponse({ status: 200, description: 'Returns the license option' })
  @ApiResponse({ status: 404, description: 'License option not found' })
  @ApiParam({ name: 'id', description: 'License option ID' })
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
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
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateLicenseDto: UpdateLicenseDto,
  ) {
    return this.licenseService.update(id, user.id, updateLicenseDto);
  }

  @Delete(':id')
  @Admin()
  @ApiOperation({ summary: 'Delete a license option' })
  @ApiResponse({ status: 200, description: 'License option successfully deleted' })
  @ApiResponse({ status: 404, description: 'License option not found' })
  @ApiParam({ name: 'id', description: 'License option ID' })
  remove(@CurrentUser() user: User, @Param('id', new ParseUUIDPipe()) id: string) {
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
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    // Create a simple order for the license
    const dto: CreateOrderDto = {
      ...createOrderDto,
      license_id: id,
    };
    return this.orderService.create(user.id, dto);
  }

  @Post(':id/checkout')
  @ApiOperation({ summary: 'Create Stripe Checkout Session for license purchase' })
  @ApiResponse({ status: 201, description: 'Checkout session created with redirect URL' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 404, description: 'License option not found' })
  @ApiParam({ name: 'id', description: 'License option ID' })
  @Authenticated()
  async createCheckout(
    @CurrentUser() user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() checkoutDto: CheckoutLicenseDto,
  ) {
    // Get the license details
    const license = await this.licenseService.findOne(id);

    // Create order first
    const order = await this.orderService.create(user.id, {
      license_id: id,
      billing: checkoutDto.billing,
      notes: checkoutDto.notes,
      coupon_code: checkoutDto.coupon_code,
    });

    // Get or create Stripe customer
    const customerName =
      `${checkoutDto.billing.first_name} ${checkoutDto.billing.last_name}`.trim();
    const customer = await this.stripeService.createOrGetCustomer(
      user.id,
      user.email,
      customerName,
    );

    // Get frontend URL for redirects
    const frontendUrl =
      this.configService.get<string>('USER_DASHBOARD_URL') || 'http://localhost:3001';

    // Create Stripe Checkout Session
    const session = await this.stripeService.createLicenseCheckoutSession({
      customerId: customer.id,
      orderId: order.id,
      licenseId: license.id,
      licenseName: license.name,
      amount: order.amount,
      currency: order.currency,
      period: license.period,
      successUrl: `${frontendUrl}/purchase/success`,
      cancelUrl: `${frontendUrl}/purchase?cancelled=true`,
      customerEmail: user.email,
      metadata: {
        user_id: user.id,
        billing_email: checkoutDto.billing.email,
      },
    });

    return {
      checkoutUrl: session.url,
      sessionId: session.sessionId,
      orderId: order.id,
      isSubscription: license.period !== LicensePeriod.FOREVER,
    };
  }
}
