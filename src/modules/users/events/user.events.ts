import { User } from '../entities/user.entity';

/**
 * Event names for user-related events
 */
export enum UserEventType {
  // User lifecycle events
  USER_CREATED = 'user.created',
  USER_UPDATED = 'user.updated',
  USER_DELETED = 'user.deleted',
  USER_VERIFIED = 'user.verified',

  // Authentication events
  USER_LOGIN = 'user.login',
  USER_LOGOUT = 'user.logout',
  PASSWORD_RESET_REQUESTED = 'user.password.reset.requested',
  PASSWORD_CHANGED = 'user.password.changed',
}

/**
 * Base interface for all user events
 */
export interface BaseUserEvent {
  userId: string;
  timestamp: Date;
}

/**
 * Event emitted when a user is created
 */
export class UserCreatedEvent implements BaseUserEvent {
  constructor(
    public readonly userId: string,
    public readonly user: User,
    public readonly email: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when a user is updated
 */
export class UserUpdatedEvent implements BaseUserEvent {
  constructor(
    public readonly userId: string,
    public readonly user: User,
    public readonly updatedFields: string[],
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when a user is verified
 */
export class UserVerifiedEvent implements BaseUserEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly firstName: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when password reset is requested
 */
export class PasswordResetRequestedEvent implements BaseUserEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly resetToken: string,
    public readonly expiresAt: Date,
    public readonly timestamp: Date = new Date(),
  ) {}
}
