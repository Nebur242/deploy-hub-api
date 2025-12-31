import { User } from '../../users/entities/user.entity';
import { Deployment, DeploymentStatus } from '../entities/deployment.entity';

/**
 * Event names for deployment-related events
 */
export enum DeploymentEventType {
  // Deployment lifecycle events
  DEPLOYMENT_CREATED = 'deployment.created',
  DEPLOYMENT_STARTED = 'deployment.started',
  DEPLOYMENT_COMPLETED = 'deployment.completed',
  DEPLOYMENT_FAILED = 'deployment.failed',
  DEPLOYMENT_RETRIED = 'deployment.retried',
  DEPLOYMENT_REDEPLOYED = 'deployment.redeployed',
  DEPLOYMENT_CANCELED = 'deployment.canceled',
  DEPLOYMENT_TIMEOUT = 'deployment.timeout',

  // Status update events
  DEPLOYMENT_STATUS_UPDATED = 'deployment.status.updated',

  // Webhook events
  DEPLOYMENT_WEBHOOK_CREATED = 'deployment.webhook.created',
  DEPLOYMENT_WEBHOOK_DELETED = 'deployment.webhook.deleted',

  // Limit-related events
  DEPLOYMENT_LIMIT_REACHED = 'deployment.limit.reached',

  // Concurrency events
  DEPLOYMENT_LOCK_ACQUIRED = 'deployment.lock.acquired',
  DEPLOYMENT_LOCK_RELEASED = 'deployment.lock.released',
  DEPLOYMENT_LOCK_CONFLICT = 'deployment.lock.conflict',
}

/**
 * Base interface for all deployment events
 */
export interface BaseDeploymentEvent {
  deploymentId: string;
  timestamp: Date;
}

/**
 * Event emitted when a deployment is created
 */
export class DeploymentCreatedEvent implements BaseDeploymentEvent {
  constructor(
    public readonly deploymentId: string,
    public readonly deployment: Deployment,
    public readonly userId: string,
    public readonly isProjectOwner: boolean,
    public readonly isTestDeployment: boolean,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when a deployment starts running
 */
export class DeploymentStartedEvent implements BaseDeploymentEvent {
  constructor(
    public readonly deploymentId: string,
    public readonly workflowRunId: string,
    public readonly githubUsername: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when a deployment completes successfully
 */
export class DeploymentCompletedEvent implements BaseDeploymentEvent {
  constructor(
    public readonly deploymentId: string,
    public readonly deployment: Deployment,
    public readonly deploymentUrl: string | null,
    public readonly userId: string,
    public readonly isProjectOwner: boolean,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when a deployment fails
 */
export class DeploymentFailedEvent implements BaseDeploymentEvent {
  constructor(
    public readonly deploymentId: string,
    public readonly errorMessage: string,
    public readonly userId: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when a deployment is retried
 */
export class DeploymentRetriedEvent implements BaseDeploymentEvent {
  constructor(
    public readonly deploymentId: string,
    public readonly originalDeploymentId: string,
    public readonly userId: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when a redeployment is created
 */
export class DeploymentRedeployedEvent implements BaseDeploymentEvent {
  constructor(
    public readonly deploymentId: string,
    public readonly originalDeploymentId: string,
    public readonly deployment: Deployment,
    public readonly user: User,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when deployment status is updated
 */
export class DeploymentStatusUpdatedEvent implements BaseDeploymentEvent {
  constructor(
    public readonly deploymentId: string,
    public readonly previousStatus: DeploymentStatus,
    public readonly newStatus: DeploymentStatus,
    public readonly deploymentUrl?: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when a webhook is created for a deployment
 */
export class DeploymentWebhookCreatedEvent implements BaseDeploymentEvent {
  constructor(
    public readonly deploymentId: string,
    public readonly hookId: number,
    public readonly repositoryOwner: string,
    public readonly repositoryName: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when a webhook is deleted for a deployment
 */
export class DeploymentWebhookDeletedEvent implements BaseDeploymentEvent {
  constructor(
    public readonly deploymentId: string,
    public readonly hookId: number,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when deployment limit is reached
 */
export class DeploymentLimitReachedEvent {
  constructor(
    public readonly userId: string,
    public readonly limitType: 'subscription' | 'license',
    public readonly currentCount: number,
    public readonly maxAllowed: number,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when a deployment is canceled
 */
export class DeploymentCanceledEvent implements BaseDeploymentEvent {
  constructor(
    public readonly deploymentId: string,
    public readonly userId: string,
    public readonly reason: string,
    public readonly wasWorkflowCanceled: boolean,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when a deployment times out
 */
export class DeploymentTimeoutEvent implements BaseDeploymentEvent {
  constructor(
    public readonly deploymentId: string,
    public readonly timeoutType: 'running' | 'pending' | 'manual',
    public readonly reason: string,
    public readonly userId: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when a deployment lock is acquired
 */
export class DeploymentLockAcquiredEvent implements BaseDeploymentEvent {
  constructor(
    public readonly deploymentId: string,
    public readonly projectId: string,
    public readonly environment: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when a deployment lock is released
 */
export class DeploymentLockReleasedEvent implements BaseDeploymentEvent {
  constructor(
    public readonly deploymentId: string,
    public readonly projectId: string,
    public readonly environment: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}

/**
 * Event emitted when there's a deployment lock conflict
 */
export class DeploymentLockConflictEvent implements BaseDeploymentEvent {
  constructor(
    public readonly deploymentId: string,
    public readonly projectId: string,
    public readonly environment: string,
    public readonly conflictingDeploymentId: string,
    public readonly timestamp: Date = new Date(),
  ) {}
}
