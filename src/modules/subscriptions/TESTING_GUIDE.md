# Subscription System Testing Guide

This guide provides comprehensive testing strategies and examples for the subscription module, including unit tests, integration tests, and end-to-end testing scenarios.

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Unit Tests](#unit-tests)
3. [Integration Tests](#integration-tests)
4. [E2E Tests](#e2e-tests)
5. [Stripe Testing](#stripe-testing)
6. [Test Data Setup](#test-data-setup)
7. [Testing Workflows](#testing-workflows)

## Testing Overview

### Test Structure

```
src/modules/subscriptions/__test__/
├── unit/
│   ├── services/
│   │   ├── subscription-plan.service.spec.ts
│   │   ├── user-subscription.service.spec.ts
│   │   ├── stripe.service.spec.ts
│   │   └── subscription-seeder.service.spec.ts
│   ├── controllers/
│   │   ├── subscription-plan.controller.spec.ts
│   │   ├── user-subscription.controller.spec.ts
│   │   └── stripe-webhook.controller.spec.ts
│   └── entities/
│       ├── subscription-plan.entity.spec.ts
│       └── user-subscription.entity.spec.ts
├── integration/
│   ├── subscription-flow.spec.ts
│   ├── stripe-integration.spec.ts
│   └── seeding.spec.ts
└── e2e/
    ├── subscription-lifecycle.spec.ts
    ├── upgrade-flow.spec.ts
    └── webhook-handling.spec.ts
```

## Unit Tests

### 1. Subscription Plan Service Tests

```typescript
// src/modules/subscriptions/__test__/unit/services/subscription-plan.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlanService } from '../../../services/subscription-plan.service';
import { SubscriptionPlan } from '../../../entities/subscription-plan.entity';
import { PlanType } from '../../../enums/plan-type.enum';
import { CreateSubscriptionPlanDto } from '../../../dto/create-subscription-plan.dto';
import { FilterSubscriptionPlanDto } from '../../../dto/filter-subscription-plan.dto';

describe('SubscriptionPlanService', () => {
  let service: SubscriptionPlanService;
  let repository: Repository<SubscriptionPlan>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionPlanService,
        {
          provide: getRepositoryToken(SubscriptionPlan),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<SubscriptionPlanService>(SubscriptionPlanService);
    repository = module.get<Repository<SubscriptionPlan>>(getRepositoryToken(SubscriptionPlan));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a subscription plan successfully', async () => {
      const createDto: CreateSubscriptionPlanDto = {
        name: 'Basic Plan',
        type: PlanType.BASIC,
        price: 999,
        currency: 'usd',
        billingInterval: 'month',
        features: ['Feature 1', 'Feature 2'],
        limits: { projects: 5 },
        stripeProductId: 'prod_test',
        stripePriceId: 'price_test',
      };

      const mockPlan = {
        id: '1',
        ...createDto,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockRepository.create.mockReturnValue(mockPlan);
      mockRepository.save.mockResolvedValue(mockPlan);

      const result = await service.create(createDto);

      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockRepository.save).toHaveBeenCalledWith(mockPlan);
      expect(result).toEqual(mockPlan);
    });

    it('should throw error if plan creation fails', async () => {
      const createDto: CreateSubscriptionPlanDto = {
        name: 'Basic Plan',
        type: PlanType.BASIC,
        price: 999,
        currency: 'usd',
        billingInterval: 'month',
        features: ['Feature 1'],
        limits: { projects: 5 },
      };

      mockRepository.create.mockReturnValue(createDto);
      mockRepository.save.mockRejectedValue(new Error('Database error'));

      await expect(service.create(createDto)).rejects.toThrow('Database error');
    });
  });

  describe('findAll', () => {
    it('should return filtered plans', async () => {
      const filter: FilterSubscriptionPlanDto = {
        type: PlanType.BASIC,
        isActive: true,
      };

      const mockPlans = [
        {
          id: '1',
          name: 'Basic Plan',
          type: PlanType.BASIC,
          isActive: true,
        },
      ];

      const mockQueryBuilder = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockPlans),
      };

      mockRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      const result = await service.findAll(filter);

      expect(mockRepository.createQueryBuilder).toHaveBeenCalledWith('plan');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('plan.type = :type', {
        type: PlanType.BASIC,
      });
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('plan.isActive = :isActive', {
        isActive: true,
      });
      expect(result).toEqual(mockPlans);
    });
  });

  describe('findById', () => {
    it('should return plan by id', async () => {
      const planId = '1';
      const mockPlan = {
        id: planId,
        name: 'Basic Plan',
        type: PlanType.BASIC,
      };

      mockRepository.findOne.mockResolvedValue(mockPlan);

      const result = await service.findById(planId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: planId },
      });
      expect(result).toEqual(mockPlan);
    });

    it('should return null if plan not found', async () => {
      const planId = 'non-existent';

      mockRepository.findOne.mockResolvedValue(null);

      const result = await service.findById(planId);

      expect(result).toBeNull();
    });
  });
});
```

### 2. User Subscription Service Tests

```typescript
// src/modules/subscriptions/__test__/unit/services/user-subscription.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserSubscriptionService } from '../../../services/user-subscription.service';
import { SubscriptionPlanService } from '../../../services/subscription-plan.service';
import { StripeService } from '../../../services/stripe.service';
import { UserSubscription } from '../../../entities/user-subscription.entity';
import { SubscriptionPlan } from '../../../entities/subscription-plan.entity';
import { User } from '../../../../users/entities/user.entity';
import { SubscriptionStatus } from '../../../enums/subscription-status.enum';
import { PlanType } from '../../../enums/plan-type.enum';

describe('UserSubscriptionService', () => {
  let service: UserSubscriptionService;
  let repository: Repository<UserSubscription>;
  let planService: SubscriptionPlanService;
  let stripeService: StripeService;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockPlanService = {
    findById: jest.fn(),
    findAll: jest.fn(),
  };

  const mockStripeService = {
    createCustomer: jest.fn(),
    createSubscription: jest.fn(),
    updateSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserSubscriptionService,
        {
          provide: getRepositoryToken(UserSubscription),
          useValue: mockRepository,
        },
        {
          provide: SubscriptionPlanService,
          useValue: mockPlanService,
        },
        {
          provide: StripeService,
          useValue: mockStripeService,
        },
      ],
    }).compile();

    service = module.get<UserSubscriptionService>(UserSubscriptionService);
    repository = module.get<Repository<UserSubscription>>(getRepositoryToken(UserSubscription));
    planService = module.get<SubscriptionPlanService>(SubscriptionPlanService);
    stripeService = module.get<StripeService>(StripeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSubscription', () => {
    const mockUser: User = {
      id: 'user-1',
      email: 'test@example.com',
      firebaseId: 'firebase-123',
    } as User;

    const mockFreePlan: SubscriptionPlan = {
      id: 'plan-1',
      name: 'Free Plan',
      type: PlanType.FREE,
      price: 0,
      currency: 'usd',
      billingInterval: 'month',
      features: ['Basic feature'],
      limits: { projects: 1 },
      isActive: true,
    } as SubscriptionPlan;

    const mockPaidPlan: SubscriptionPlan = {
      id: 'plan-2',
      name: 'Basic Plan',
      type: PlanType.BASIC,
      price: 999,
      currency: 'usd',
      billingInterval: 'month',
      features: ['Basic feature', 'Advanced feature'],
      limits: { projects: 5 },
      isActive: true,
      stripeProductId: 'prod_test',
      stripePriceId: 'price_test',
    } as SubscriptionPlan;

    it('should create free subscription without payment method', async () => {
      mockPlanService.findById.mockResolvedValue(mockFreePlan);
      mockRepository.findOne.mockResolvedValue(null);

      const mockSubscription = {
        id: 'sub-1',
        user: mockUser,
        plan: mockFreePlan,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      mockRepository.create.mockReturnValue(mockSubscription);
      mockRepository.save.mockResolvedValue(mockSubscription);

      const result = await service.createSubscription(mockUser, {
        planId: mockFreePlan.id,
      });

      expect(mockPlanService.findById).toHaveBeenCalledWith(mockFreePlan.id);
      expect(mockRepository.create).toHaveBeenCalled();
      expect(mockRepository.save).toHaveBeenCalled();
      expect(stripeService.createCustomer).not.toHaveBeenCalled();
      expect(result).toEqual(mockSubscription);
    });

    it('should create paid subscription with payment method', async () => {
      const paymentMethodId = 'pm_test';

      mockPlanService.findById.mockResolvedValue(mockPaidPlan);
      mockRepository.findOne.mockResolvedValue(null);
      mockStripeService.createCustomer.mockResolvedValue({
        id: 'cus_test',
      });
      mockStripeService.createSubscription.mockResolvedValue({
        id: 'sub_stripe_test',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
      });

      const mockSubscription = {
        id: 'sub-1',
        user: mockUser,
        plan: mockPaidPlan,
        status: SubscriptionStatus.ACTIVE,
        stripeSubscriptionId: 'sub_stripe_test',
        stripeCustomerId: 'cus_test',
      };

      mockRepository.create.mockReturnValue(mockSubscription);
      mockRepository.save.mockResolvedValue(mockSubscription);

      const result = await service.createSubscription(mockUser, {
        planId: mockPaidPlan.id,
        paymentMethodId,
      });

      expect(stripeService.createCustomer).toHaveBeenCalledWith({
        email: mockUser.email,
        paymentMethodId,
      });
      expect(stripeService.createSubscription).toHaveBeenCalled();
      expect(result).toEqual(mockSubscription);
    });

    it('should throw error if user already has active subscription', async () => {
      const existingSubscription = {
        id: 'existing-sub',
        status: SubscriptionStatus.ACTIVE,
      };

      mockRepository.findOne.mockResolvedValue(existingSubscription);

      await expect(service.createSubscription(mockUser, { planId: 'plan-1' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error if plan not found', async () => {
      mockPlanService.findById.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createSubscription(mockUser, { planId: 'non-existent' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if paid plan requested without payment method', async () => {
      mockPlanService.findById.mockResolvedValue(mockPaidPlan);
      mockRepository.findOne.mockResolvedValue(null);

      await expect(
        service.createSubscription(mockUser, { planId: mockPaidPlan.id }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('upgradePlan', () => {
    const mockUser: User = {
      id: 'user-1',
      email: 'test@example.com',
    } as User;

    const mockCurrentPlan: SubscriptionPlan = {
      id: 'plan-1',
      type: PlanType.FREE,
      price: 0,
    } as SubscriptionPlan;

    const mockUpgradePlan: SubscriptionPlan = {
      id: 'plan-2',
      type: PlanType.BASIC,
      price: 999,
      stripePriceId: 'price_test',
    } as SubscriptionPlan;

    const mockCurrentSubscription: UserSubscription = {
      id: 'sub-1',
      user: mockUser,
      plan: mockCurrentPlan,
      status: SubscriptionStatus.ACTIVE,
      stripeSubscriptionId: 'sub_stripe_test',
    } as UserSubscription;

    it('should upgrade subscription successfully', async () => {
      mockRepository.findOne.mockResolvedValue(mockCurrentSubscription);
      mockPlanService.findById.mockResolvedValue(mockUpgradePlan);

      mockStripeService.updateSubscription.mockResolvedValue({
        id: 'sub_stripe_test',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
      });

      const updatedSubscription = {
        ...mockCurrentSubscription,
        plan: mockUpgradePlan,
      };

      mockRepository.save.mockResolvedValue(updatedSubscription);

      const result = await service.upgradePlan(mockUser, {
        planId: mockUpgradePlan.id,
        prorationBehavior: 'create_prorations',
      });

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { user: { id: mockUser.id }, status: SubscriptionStatus.ACTIVE },
        relations: ['plan', 'user'],
      });
      expect(mockPlanService.findById).toHaveBeenCalledWith(mockUpgradePlan.id);
      expect(stripeService.updateSubscription).toHaveBeenCalled();
      expect(result).toEqual(updatedSubscription);
    });

    it('should throw error if no active subscription found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.upgradePlan(mockUser, { planId: 'plan-2' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error if upgrade plan not found', async () => {
      mockRepository.findOne.mockResolvedValue(mockCurrentSubscription);
      mockPlanService.findById.mockResolvedValue(null);

      await expect(service.upgradePlan(mockUser, { planId: 'non-existent' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw error if trying to downgrade', async () => {
      const premiumPlan = { ...mockCurrentPlan, type: PlanType.PREMIUM };
      const basicPlan = { ...mockUpgradePlan, type: PlanType.BASIC };
      const premiumSubscription = {
        ...mockCurrentSubscription,
        plan: premiumPlan,
      };

      mockRepository.findOne.mockResolvedValue(premiumSubscription);
      mockPlanService.findById.mockResolvedValue(basicPlan);

      await expect(service.upgradePlan(mockUser, { planId: basicPlan.id })).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
```

### 3. Stripe Service Tests

```typescript
// src/modules/subscriptions/__test__/unit/services/stripe.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StripeService } from '../../../services/stripe.service';
import Stripe from 'stripe';

jest.mock('stripe');

describe('StripeService', () => {
  let service: StripeService;
  let configService: ConfigService;
  let mockStripe: jest.Mocked<Stripe>;

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    mockStripe = {
      customers: {
        create: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
      },
      subscriptions: {
        create: jest.fn(),
        retrieve: jest.fn(),
        update: jest.fn(),
        cancel: jest.fn(),
      },
      paymentMethods: {
        attach: jest.fn(),
      },
      billingPortal: {
        sessions: {
          create: jest.fn(),
        },
      },
      webhooks: {
        constructEvent: jest.fn(),
      },
    } as any;

    (Stripe as jest.MockedClass<typeof Stripe>).mockImplementation(() => mockStripe);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<StripeService>(StripeService);
    configService = module.get<ConfigService>(ConfigService);

    mockConfigService.get.mockImplementation((key: string) => {
      switch (key) {
        case 'STRIPE_SECRET_KEY':
          return 'sk_test_123';
        case 'STRIPE_WEBHOOK_SECRET':
          return 'whsec_test';
        default:
          return null;
      }
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createCustomer', () => {
    it('should create customer successfully', async () => {
      const customerData = {
        email: 'test@example.com',
        paymentMethodId: 'pm_test',
      };

      const mockCustomer = {
        id: 'cus_test',
        email: customerData.email,
      };

      mockStripe.customers.create.mockResolvedValue(mockCustomer as any);
      mockStripe.paymentMethods.attach.mockResolvedValue({} as any);

      const result = await service.createCustomer(customerData);

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: customerData.email,
      });
      expect(mockStripe.paymentMethods.attach).toHaveBeenCalledWith(customerData.paymentMethodId, {
        customer: mockCustomer.id,
      });
      expect(result).toEqual(mockCustomer);
    });

    it('should create customer without payment method', async () => {
      const customerData = {
        email: 'test@example.com',
      };

      const mockCustomer = {
        id: 'cus_test',
        email: customerData.email,
      };

      mockStripe.customers.create.mockResolvedValue(mockCustomer as any);

      const result = await service.createCustomer(customerData);

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: customerData.email,
      });
      expect(mockStripe.paymentMethods.attach).not.toHaveBeenCalled();
      expect(result).toEqual(mockCustomer);
    });
  });

  describe('createSubscription', () => {
    it('should create subscription successfully', async () => {
      const subscriptionData = {
        customerId: 'cus_test',
        priceId: 'price_test',
      };

      const mockSubscription = {
        id: 'sub_test',
        customer: subscriptionData.customerId,
        status: 'active',
        current_period_start: 1234567890,
        current_period_end: 1234567890,
      };

      mockStripe.subscriptions.create.mockResolvedValue(mockSubscription as any);

      const result = await service.createSubscription(subscriptionData);

      expect(mockStripe.subscriptions.create).toHaveBeenCalledWith({
        customer: subscriptionData.customerId,
        items: [{ price: subscriptionData.priceId }],
        expand: ['latest_invoice.payment_intent'],
      });
      expect(result).toEqual(mockSubscription);
    });
  });

  describe('constructWebhookEvent', () => {
    it('should construct webhook event successfully', () => {
      const payload = JSON.stringify({ type: 'customer.subscription.created' });
      const signature = 'test_signature';
      const mockEvent = { type: 'customer.subscription.created' };

      mockStripe.webhooks.constructEvent.mockReturnValue(mockEvent as any);

      const result = service.constructWebhookEvent(payload, signature);

      expect(mockStripe.webhooks.constructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        'whsec_test',
      );
      expect(result).toEqual(mockEvent);
    });

    it('should throw error for invalid signature', () => {
      const payload = JSON.stringify({ type: 'test' });
      const signature = 'invalid_signature';

      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      expect(() => service.constructWebhookEvent(payload, signature)).toThrow('Invalid signature');
    });
  });
});
```

## Integration Tests

### 1. Subscription Flow Integration Test

```typescript
// src/modules/subscriptions/__test__/integration/subscription-flow.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { SubscriptionsModule } from '../../subscriptions.module';
import { DatabaseModule } from '../../../database/database.module';
import { UsersModule } from '../../../users/users.module';
import { SubscriptionPlan } from '../../entities/subscription-plan.entity';
import { UserSubscription } from '../../entities/user-subscription.entity';
import { User } from '../../../users/entities/user.entity';
import { PlanType } from '../../enums/plan-type.enum';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

describe('Subscription Flow (Integration)', () => {
  let app: INestApplication;
  let userRepository: Repository<User>;
  let planRepository: Repository<SubscriptionPlan>;
  let subscriptionRepository: Repository<UserSubscription>;
  let authToken: string;
  let testUser: User;
  let testPlan: SubscriptionPlan;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: '.env.test',
        }),
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User, SubscriptionPlan, UserSubscription],
          synchronize: true,
        }),
        SubscriptionsModule,
        UsersModule,
        DatabaseModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    userRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    planRepository = moduleFixture.get<Repository<SubscriptionPlan>>(
      getRepositoryToken(SubscriptionPlan),
    );
    subscriptionRepository = moduleFixture.get<Repository<UserSubscription>>(
      getRepositoryToken(UserSubscription),
    );

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(async () => {
    // Clean up subscriptions after each test
    await subscriptionRepository.delete({});
  });

  const setupTestData = async () => {
    // Create test user
    testUser = await userRepository.save({
      email: 'test@example.com',
      firebaseId: 'firebase-test-123',
      firstName: 'Test',
      lastName: 'User',
    });

    // Create test plan
    testPlan = await planRepository.save({
      name: 'Test Basic Plan',
      type: PlanType.BASIC,
      price: 999,
      currency: 'usd',
      billingInterval: 'month',
      features: ['Feature 1', 'Feature 2'],
      limits: { projects: 5 },
      isActive: true,
      stripePriceId: 'price_test',
      stripeProductId: 'prod_test',
    });

    // Mock auth token (implement according to your auth system)
    authToken = 'Bearer mock-jwt-token';
  };

  describe('GET /subscription-plans', () => {
    it('should return available subscription plans', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/subscription-plans')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('id');
      expect(response.body.data[0]).toHaveProperty('name');
      expect(response.body.data[0]).toHaveProperty('price');
    });

    it('should filter plans by type', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/subscription-plans?type=basic')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.data.every(plan => plan.type === 'basic')).toBe(true);
    });
  });

  describe('POST /user-subscriptions', () => {
    it('should create free subscription without payment method', async () => {
      // Create free plan
      const freePlan = await planRepository.save({
        name: 'Free Plan',
        type: PlanType.FREE,
        price: 0,
        currency: 'usd',
        billingInterval: 'month',
        features: ['Basic Feature'],
        limits: { projects: 1 },
        isActive: true,
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/user-subscriptions')
        .set('Authorization', authToken)
        .send({
          planId: freePlan.id,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.status).toBe('active');
      expect(response.body.data.plan.id).toBe(freePlan.id);
    });

    it('should fail to create paid subscription without payment method', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/user-subscriptions')
        .set('Authorization', authToken)
        .send({
          planId: testPlan.id,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('payment method');
    });

    it('should fail if user already has active subscription', async () => {
      // Create existing subscription
      await subscriptionRepository.save({
        user: testUser,
        plan: testPlan,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/user-subscriptions')
        .set('Authorization', authToken)
        .send({
          planId: testPlan.id,
          paymentMethodId: 'pm_test',
        })
        .expect(400);

      expect(response.body.message).toContain('already has an active subscription');
    });
  });

  describe('GET /user-subscriptions/current', () => {
    it('should return current user subscription', async () => {
      // Create subscription for test
      const subscription = await subscriptionRepository.save({
        user: testUser,
        plan: testPlan,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/user-subscriptions/current')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(subscription.id);
      expect(response.body.data).toHaveProperty('plan');
      expect(response.body.data.plan.id).toBe(testPlan.id);
    });

    it('should return 404 if user has no subscription', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/user-subscriptions/current')
        .set('Authorization', authToken)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /user-subscriptions/upgrade-options', () => {
    it('should return upgrade options for current subscription', async () => {
      // Create current subscription with basic plan
      await subscriptionRepository.save({
        user: testUser,
        plan: testPlan,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      // Create premium plan for upgrade
      const premiumPlan = await planRepository.save({
        name: 'Premium Plan',
        type: PlanType.PREMIUM,
        price: 1999,
        currency: 'usd',
        billingInterval: 'month',
        features: ['All Features'],
        limits: { projects: 20 },
        isActive: true,
        stripePriceId: 'price_premium',
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/user-subscriptions/upgrade-options')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data[0]).toHaveProperty('planId');
      expect(response.body.data[0]).toHaveProperty('plan');
      expect(response.body.data[0]).toHaveProperty('proratedAmount');
    });
  });
});
```

## Stripe Testing

### 1. Stripe Test Configuration

```typescript
// src/modules/subscriptions/__test__/stripe-test.config.ts
export const stripeTestConfig = {
  // Test API keys (use Stripe test keys)
  secretKey: 'sk_test_...',
  publishableKey: 'pk_test_...',

  // Test webhook endpoint secret
  webhookSecret: 'whsec_test_...',

  // Test product and price IDs
  testProducts: {
    basic: 'prod_test_basic',
    premium: 'prod_test_premium',
  },

  testPrices: {
    basic: 'price_test_basic',
    premium: 'price_test_premium',
  },

  // Test payment methods
  testCards: {
    visa: 'pm_card_visa',
    mastercard: 'pm_card_mastercard',
    declined: 'pm_card_chargeDeclined',
  },
};
```

### 2. Webhook Testing

```typescript
// src/modules/subscriptions/__test__/integration/stripe-webhook.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { StripeWebhookController } from '../../controllers/stripe-webhook.controller';
import { StripeService } from '../../services/stripe.service';
import { UserSubscriptionService } from '../../services/user-subscription.service';

describe('Stripe Webhook (Integration)', () => {
  let app: INestApplication;
  let stripeService: StripeService;

  const mockStripeService = {
    constructWebhookEvent: jest.fn(),
  };

  const mockUserSubscriptionService = {
    handleStripeSubscriptionCreated: jest.fn(),
    handleStripeSubscriptionUpdated: jest.fn(),
    handleStripeSubscriptionDeleted: jest.fn(),
    handleStripePaymentSucceeded: jest.fn(),
    handleStripePaymentFailed: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [StripeWebhookController],
      providers: [
        {
          provide: StripeService,
          useValue: mockStripeService,
        },
        {
          provide: UserSubscriptionService,
          useValue: mockUserSubscriptionService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    stripeService = moduleFixture.get<StripeService>(StripeService);
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /webhooks/stripe', () => {
    it('should handle subscription.created event', async () => {
      const webhookEvent = {
        type: 'customer.subscription.created',
        data: {
          object: {
            id: 'sub_test',
            customer: 'cus_test',
            status: 'active',
          },
        },
      };

      mockStripeService.constructWebhookEvent.mockReturnValue(webhookEvent);
      mockUserSubscriptionService.handleStripeSubscriptionCreated.mockResolvedValue(undefined);

      const response = await request(app.getHttpServer())
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(webhookEvent))
        .expect(200);

      expect(mockStripeService.constructWebhookEvent).toHaveBeenCalled();
      expect(mockUserSubscriptionService.handleStripeSubscriptionCreated).toHaveBeenCalledWith(
        webhookEvent.data.object,
      );
      expect(response.body.received).toBe(true);
    });

    it('should handle payment_succeeded event', async () => {
      const webhookEvent = {
        type: 'invoice.payment_succeeded',
        data: {
          object: {
            id: 'in_test',
            subscription: 'sub_test',
            amount_paid: 999,
          },
        },
      };

      mockStripeService.constructWebhookEvent.mockReturnValue(webhookEvent);
      mockUserSubscriptionService.handleStripePaymentSucceeded.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'test_signature')
        .send(JSON.stringify(webhookEvent))
        .expect(200);

      expect(mockUserSubscriptionService.handleStripePaymentSucceeded).toHaveBeenCalledWith(
        webhookEvent.data.object,
      );
    });

    it('should return 400 for invalid signature', async () => {
      mockStripeService.constructWebhookEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await request(app.getHttpServer())
        .post('/api/v1/webhooks/stripe')
        .set('stripe-signature', 'invalid_signature')
        .send('{"type": "test"}')
        .expect(400);
    });
  });
});
```

## E2E Tests

### 1. Complete Subscription Lifecycle E2E Test

```typescript
// src/modules/subscriptions/__test__/e2e/subscription-lifecycle.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../app.module';

describe('Subscription Lifecycle (E2E)', () => {
  let app: INestApplication;
  let authToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Setup authentication
    authToken = await setupAuthentication();
  });

  afterAll(async () => {
    await app.close();
  });

  const setupAuthentication = async (): Promise<string> => {
    // Create test user and get auth token
    // This depends on your authentication implementation
    return 'Bearer test-token';
  };

  describe('Full subscription workflow', () => {
    let freePlanId: string;
    let basicPlanId: string;
    let subscriptionId: string;

    it('should get available plans', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/subscription-plans?isActive=true')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);

      const freePlan = response.body.data.find(p => p.type === 'free');
      const basicPlan = response.body.data.find(p => p.type === 'basic');

      expect(freePlan).toBeDefined();
      expect(basicPlan).toBeDefined();

      freePlanId = freePlan.id;
      basicPlanId = basicPlan.id;
    });

    it('should create free subscription', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/user-subscriptions')
        .set('Authorization', authToken)
        .send({ planId: freePlanId })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('active');
      expect(response.body.data.plan.type).toBe('free');

      subscriptionId = response.body.data.id;
    });

    it('should get current subscription', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/user-subscriptions/current')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.data.id).toBe(subscriptionId);
      expect(response.body.data.plan.type).toBe('free');
    });

    it('should get upgrade options', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/user-subscriptions/upgrade-options')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.data.find(o => o.planId === basicPlanId)).toBeDefined();
    });

    it('should get subscription statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/user-subscriptions/statistics')
        .set('Authorization', authToken)
        .expect(200);

      expect(response.body.data).toHaveProperty('totalSubscriptions');
      expect(response.body.data).toHaveProperty('activeSubscriptions');
      expect(response.body.data).toHaveProperty('planDistribution');
    });

    // Note: Upgrade test would require mock Stripe integration
    // as it involves payment processing
  });

  describe('Subscription enforcement', () => {
    it('should enforce project limits based on subscription', async () => {
      // This test would check that project creation
      // respects subscription limits

      // Create projects up to the limit
      const subscription = await request(app.getHttpServer())
        .get('/api/v1/user-subscriptions/current')
        .set('Authorization', authToken);

      const projectLimit = subscription.body.data.plan.limits.projects;

      // Create projects up to limit
      for (let i = 0; i < projectLimit; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/projects')
          .set('Authorization', authToken)
          .send({
            name: `Test Project ${i}`,
            description: 'Test project',
          })
          .expect(201);
      }

      // Try to create one more project (should fail)
      await request(app.getHttpServer())
        .post('/api/v1/projects')
        .set('Authorization', authToken)
        .send({
          name: 'Exceeding Project',
          description: 'This should fail',
        })
        .expect(402); // Payment Required
    });
  });
});
```

## Test Data Setup

### 1. Test Data Factory

```typescript
// src/modules/subscriptions/__test__/factories/test-data.factory.ts
import { SubscriptionPlan } from '../../entities/subscription-plan.entity';
import { UserSubscription } from '../../entities/user-subscription.entity';
import { User } from '../../../users/entities/user.entity';
import { PlanType } from '../../enums/plan-type.enum';
import { SubscriptionStatus } from '../../enums/subscription-status.enum';

export class TestDataFactory {
  static createUser(overrides: Partial<User> = {}): User {
    return {
      id: 'user-test-' + Date.now(),
      email: 'test@example.com',
      firebaseId: 'firebase-' + Date.now(),
      firstName: 'Test',
      lastName: 'User',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as User;
  }

  static createSubscriptionPlan(overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
    return {
      id: 'plan-test-' + Date.now(),
      name: 'Test Plan',
      type: PlanType.BASIC,
      price: 999,
      currency: 'usd',
      billingInterval: 'month',
      features: ['Feature 1', 'Feature 2'],
      limits: { projects: 5, deployments: 10 },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    } as SubscriptionPlan;
  }

  static createUserSubscription(
    user: User,
    plan: SubscriptionPlan,
    overrides: Partial<UserSubscription> = {},
  ): UserSubscription {
    const now = new Date();
    const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

    return {
      id: 'sub-test-' + Date.now(),
      user,
      plan,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: now,
      currentPeriodEnd: endDate,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    } as UserSubscription;
  }

  static createStripeSubscription(overrides: any = {}) {
    return {
      id: 'sub_stripe_' + Date.now(),
      customer: 'cus_test',
      status: 'active',
      current_period_start: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000),
      items: {
        data: [
          {
            price: {
              id: 'price_test',
              unit_amount: 999,
              currency: 'usd',
              recurring: { interval: 'month' },
            },
          },
        ],
      },
      ...overrides,
    };
  }

  static createStripeCustomer(overrides: any = {}) {
    return {
      id: 'cus_test_' + Date.now(),
      email: 'test@example.com',
      created: Math.floor(Date.now() / 1000),
      ...overrides,
    };
  }
}
```

## Testing Workflows

### 1. Test Execution Scripts

```json
// package.json scripts
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "test:e2e": "jest --testPathPattern=e2e",
    "test:subscription": "jest --testPathPattern=subscriptions",
    "test:stripe": "jest --testPathPattern=stripe"
  }
}
```

### 2. Jest Configuration for Subscriptions

```javascript
// jest.subscription.config.js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src/modules/subscriptions',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: [
    '**/*.(t|j)s',
    '!**/*.spec.ts',
    '!**/*.interface.ts',
    '!**/*.dto.ts',
    '!**/*.enum.ts',
  ],
  coverageDirectory: '../../../coverage/subscriptions',
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/__test__/setup.ts'],
};
```

### 3. Test Setup File

```typescript
// src/modules/subscriptions/__test__/setup.ts
import { ConfigService } from '@nestjs/config';

// Mock Stripe for all tests
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
    },
    subscriptions: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
    },
    paymentMethods: {
      attach: jest.fn(),
    },
    billingPortal: {
      sessions: {
        create: jest.fn(),
      },
    },
    webhooks: {
      constructEvent: jest.fn(),
    },
  }));
});

// Global test configuration
global.console = {
  ...console,
  // Suppress logs during tests unless DEBUG=true
  log: process.env.DEBUG ? console.log : jest.fn(),
  debug: process.env.DEBUG ? console.debug : jest.fn(),
  info: process.env.DEBUG ? console.info : jest.fn(),
  warn: console.warn,
  error: console.error,
};

// Test database cleanup
afterEach(() => {
  jest.clearAllMocks();
});
```

This comprehensive testing guide covers all aspects of testing the subscription module, from unit tests to end-to-end workflows. The tests ensure reliability, security, and proper integration with Stripe services.
