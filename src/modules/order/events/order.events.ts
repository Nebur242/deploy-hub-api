import { Order } from '../entities/order.entity';

/**
 * Event names for order-related events
 */
export enum OrderEventType {
  // Order lifecycle events
  ORDER_CREATED = 'order.created',
  ORDER_COMPLETED = 'order.completed',
  ORDER_FAILED = 'order.failed',
  ORDER_CANCELLED = 'order.cancelled',
  ORDER_REFUNDED = 'order.refunded',

  // Payment events
  PAYMENT_RECEIVED = 'order.payment.received',
  PAYMENT_FAILED = 'order.payment.failed',
}

/**
 * Base interface for all order events
 */
export interface BaseOrderEvent {
  orderId: string;
  timestamp: Date;
}

/**
 * Event emitted when an order is created
 */
export class OrderCreatedEvent implements BaseOrderEvent {
  constructor(
    public readonly orderId: string,
    public readonly order: Order,
    public readonly buyerId: string,
    public readonly buyerEmail: string,
    public readonly buyerName: string,
    public readonly licenseName: string,
    public readonly licenseOwnerId: string,
    public readonly ownerEmail: string,
    public readonly ownerName: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when an order is completed
 */
export class OrderCompletedEvent implements BaseOrderEvent {
  constructor(
    public readonly orderId: string,
    public readonly order: Order,
    public readonly buyerId: string,
    public readonly buyerEmail: string,
    public readonly buyerName: string,
    public readonly licenseName: string,
    public readonly licenseOwnerId: string,
    public readonly ownerEmail: string,
    public readonly ownerName: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when an order fails
 */
export class OrderFailedEvent implements BaseOrderEvent {
  constructor(
    public readonly orderId: string,
    public readonly order: Order,
    public readonly buyerId: string,
    public readonly buyerEmail: string,
    public readonly buyerName: string,
    public readonly licenseName: string,
    public readonly errorMessage: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when an order is cancelled
 */
export class OrderCancelledEvent implements BaseOrderEvent {
  constructor(
    public readonly orderId: string,
    public readonly order: Order,
    public readonly buyerId: string,
    public readonly buyerEmail: string,
    public readonly buyerName: string,
    public readonly licenseName: string,
    public readonly reason?: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when an order is refunded
 */
export class OrderRefundedEvent implements BaseOrderEvent {
  constructor(
    public readonly orderId: string,
    public readonly order: Order,
    public readonly buyerId: string,
    public readonly buyerEmail: string,
    public readonly buyerName: string,
    public readonly licenseName: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly licenseOwnerId: string,
    public readonly ownerEmail: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when a payment is received
 */
export class PaymentReceivedEvent implements BaseOrderEvent {
  constructor(
    public readonly orderId: string,
    public readonly paymentId: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly buyerId: string,
    public readonly buyerEmail: string,
    public readonly licenseName: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when a payment fails
 */
export class PaymentFailedEvent implements BaseOrderEvent {
  constructor(
    public readonly orderId: string,
    public readonly buyerId: string,
    public readonly buyerEmail: string,
    public readonly buyerName: string,
    public readonly licenseName: string,
    public readonly errorMessage: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}
