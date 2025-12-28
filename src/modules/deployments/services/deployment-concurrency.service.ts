import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { DeploymentStatus, DeplomentEnvironment } from '../entities/deployment.entity';
import { DeploymentRepository } from '../repositories/deployment.repository';

/**
 * Lock entry for tracking active deployment locks
 */
interface DeploymentLock {
  /** Unique key for the lock (project + environment) */
  key: string;
  /** The deployment ID holding the lock */
  deploymentId: string;
  /** When the lock was acquired */
  acquiredAt: Date;
  /** TTL for the lock in milliseconds */
  ttlMs: number;
}

/**
 * Options for acquiring a deployment lock
 */
export interface AcquireLockOptions {
  /** Project ID */
  projectId: string;
  /** Environment (staging, production, etc.) */
  environment: DeplomentEnvironment;
  /** Deployment ID requesting the lock */
  deploymentId: string;
  /** User ID who triggered the deployment */
  userId: string;
  /** Time-to-live for the lock in milliseconds (default: 30 minutes) */
  ttlMs?: number;
  /** Whether to wait for the lock or fail immediately (default: false) */
  waitForLock?: boolean;
  /** Maximum time to wait for lock in milliseconds (default: 0 - no wait) */
  maxWaitMs?: number;
}

/**
 * Result of a lock acquisition attempt
 */
export interface LockResult {
  /** Whether the lock was acquired */
  acquired: boolean;
  /** The deployment ID that holds the lock (if not acquired) */
  heldByDeploymentId?: string;
  /** Message explaining the result */
  message: string;
}

/**
 * Information about an existing deployment that may conflict
 */
export interface ConflictingDeployment {
  id: string;
  status: DeploymentStatus;
  createdAt: Date;
  environment: DeplomentEnvironment;
  branch: string;
}

/**
 * Service for managing deployment concurrency
 *
 * Provides both:
 * 1. In-memory locks for fast, non-blocking concurrency control
 * 2. Database-based conflict detection for distributed deployments
 *
 * Features:
 * - Prevents multiple deployments to the same project/environment
 * - Automatic lock cleanup on timeout
 * - Support for queued deployments (future enhancement)
 */
@Injectable()
export class DeploymentConcurrencyService {
  private readonly logger = new Logger(DeploymentConcurrencyService.name);

  /**
   * In-memory lock map for fast concurrency control
   * Key: `${projectId}:${environment}`
   */
  private readonly locks = new Map<string, DeploymentLock>();

  /** Default lock TTL: 30 minutes */
  private readonly DEFAULT_LOCK_TTL_MS = 30 * 60 * 1000;

  /** Cleanup interval for expired locks: 1 minute */
  private readonly CLEANUP_INTERVAL_MS = 60 * 1000;

  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly deploymentRepository: DeploymentRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {
    // Start periodic cleanup of expired locks
    this.startCleanupInterval();
  }

  /**
   * Start the periodic cleanup of expired locks
   */
  private startCleanupInterval(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredLocks();
    }, this.CLEANUP_INTERVAL_MS);

    // Don't prevent Node.js from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Clean up expired locks
   */
  private cleanupExpiredLocks(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, lock] of this.locks.entries()) {
      const lockAge = now - lock.acquiredAt.getTime();
      if (lockAge >= lock.ttlMs) {
        this.locks.delete(key);
        cleanedCount++;
        this.logger.warn(
          `Cleaned up expired lock for key=${key}, deploymentId=${lock.deploymentId}`,
        );
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Cleaned up ${cleanedCount} expired deployment lock(s)`);
    }
  }

  /**
   * Generate a unique lock key for a user/project/environment combination
   * This ensures different users can deploy the same project simultaneously
   */
  private generateLockKey(
    projectId: string,
    environment: DeplomentEnvironment,
    userId: string,
  ): string {
    return `${userId}:${projectId}:${environment}`;
  }

  /**
   * Check for conflicting deployments in the database
   *
   * Returns any PENDING or RUNNING deployments for the same user/project/environment
   * Different users can deploy the same project simultaneously - only the same user is blocked
   */
  async checkForConflictingDeployments(
    projectId: string,
    environment: DeplomentEnvironment,
    userId: string,
    excludeDeploymentId?: string,
  ): Promise<ConflictingDeployment[]> {
    const activeStatuses = [DeploymentStatus.PENDING, DeploymentStatus.RUNNING];

    // Only check deployments by the SAME user
    const deployments = await this.deploymentRepository.findBy({
      project_id: projectId,
      environment,
      owner_id: userId,
    });

    return deployments
      .filter(d => {
        // Exclude the current deployment if specified
        if (excludeDeploymentId && d.id === excludeDeploymentId) {
          return false;
        }
        // Only include active deployments
        return activeStatuses.includes(d.status as DeploymentStatus);
      })
      .map(d => ({
        id: d.id,
        status: d.status as DeploymentStatus,
        createdAt: d.created_at,
        environment: d.environment as DeplomentEnvironment,
        branch: d.branch,
      }));
  }

  /**
   * Attempt to acquire a lock for a deployment
   * Locks are per-user, so different users can deploy the same project simultaneously
   *
   * @returns LockResult indicating whether the lock was acquired
   */
  async acquireLock(options: AcquireLockOptions): Promise<LockResult> {
    const {
      projectId,
      environment,
      deploymentId,
      userId,
      ttlMs = this.DEFAULT_LOCK_TTL_MS,
      waitForLock = false,
      maxWaitMs = 0,
    } = options;

    const lockKey = this.generateLockKey(projectId, environment, userId);

    // Check if there's an existing in-memory lock
    const existingLock = this.locks.get(lockKey);

    if (existingLock) {
      // Check if the existing lock has expired
      const lockAge = Date.now() - existingLock.acquiredAt.getTime();
      if (lockAge < existingLock.ttlMs) {
        // Lock is still valid and held by another deployment
        if (existingLock.deploymentId !== deploymentId) {
          this.logger.warn(
            `Lock conflict: deployment ${deploymentId} cannot acquire lock held by ${existingLock.deploymentId}`,
          );

          if (waitForLock && maxWaitMs > 0) {
            // TODO: Implement wait/queue mechanism for future enhancement
            this.logger.log(`Wait for lock not yet implemented, failing immediately`);
          }

          return {
            acquired: false,
            heldByDeploymentId: existingLock.deploymentId,
            message: `Deployment ${existingLock.deploymentId} is currently active for this project/environment`,
          };
        }

        // Same deployment already holds the lock - refresh it
        existingLock.acquiredAt = new Date();
        existingLock.ttlMs = ttlMs;
        return {
          acquired: true,
          message: 'Lock refreshed for current deployment',
        };
      } else {
        // Existing lock has expired, clean it up
        this.locks.delete(lockKey);
        this.logger.log(`Cleaned up expired lock for key=${lockKey}`);
      }
    }

    // Also check for conflicting deployments in database (for distributed scenarios)
    // Only checks the same user's deployments
    const conflictingDeployments = await this.checkForConflictingDeployments(
      projectId,
      environment,
      userId,
      deploymentId,
    );

    if (conflictingDeployments.length > 0) {
      const conflicting = conflictingDeployments[0];
      this.logger.warn(
        `Database conflict: deployment ${deploymentId} conflicts with ${conflicting.id} (${conflicting.status})`,
      );

      return {
        acquired: false,
        heldByDeploymentId: conflicting.id,
        message: `Another deployment (${conflicting.id}) is already ${conflicting.status} for this project/environment`,
      };
    }

    // Acquire the lock
    const newLock: DeploymentLock = {
      key: lockKey,
      deploymentId,
      acquiredAt: new Date(),
      ttlMs,
    };

    this.locks.set(lockKey, newLock);
    this.logger.log(`Lock acquired: key=${lockKey}, deploymentId=${deploymentId}`);

    return {
      acquired: true,
      message: 'Lock acquired successfully',
    };
  }

  /**
   * Release a lock for a deployment
   */
  releaseLock(
    projectId: string,
    environment: DeplomentEnvironment,
    userId: string,
    deploymentId: string,
  ): boolean {
    const lockKey = this.generateLockKey(projectId, environment, userId);
    const existingLock = this.locks.get(lockKey);

    if (!existingLock) {
      this.logger.debug(`No lock found for key=${lockKey}`);
      return false;
    }

    if (existingLock.deploymentId !== deploymentId) {
      this.logger.warn(
        `Cannot release lock: deployment ${deploymentId} does not hold lock for key=${lockKey}`,
      );
      return false;
    }

    this.locks.delete(lockKey);
    this.logger.log(`Lock released: key=${lockKey}, deploymentId=${deploymentId}`);
    return true;
  }

  /**
   * Release a lock by deployment ID (finds the lock automatically)
   */
  releaseLockByDeploymentId(deploymentId: string): boolean {
    for (const [key, lock] of this.locks.entries()) {
      if (lock.deploymentId === deploymentId) {
        this.locks.delete(key);
        this.logger.log(`Lock released: key=${key}, deploymentId=${deploymentId}`);
        return true;
      }
    }

    this.logger.debug(`No lock found for deploymentId=${deploymentId}`);
    return false;
  }

  /**
   * Check if a deployment can proceed (no conflicts for the same user)
   *
   * @throws ConflictException if there's a conflicting deployment by the same user
   */
  async assertCanDeploy(
    projectId: string,
    environment: DeplomentEnvironment,
    userId: string,
    excludeDeploymentId?: string,
  ): Promise<void> {
    const conflicts = await this.checkForConflictingDeployments(
      projectId,
      environment,
      userId,
      excludeDeploymentId,
    );

    if (conflicts.length > 0) {
      const conflicting = conflicts[0];
      throw new ConflictException(
        `Cannot start deployment: another deployment (${conflicting.id}) is already ${conflicting.status} ` +
          `for environment "${environment}". Please wait for it to complete or cancel it first.`,
      );
    }
  }

  /**
   * Get information about a lock for a specific user
   */
  getLockInfo(
    projectId: string,
    environment: DeplomentEnvironment,
    userId: string,
  ): DeploymentLock | null {
    const lockKey = this.generateLockKey(projectId, environment, userId);
    return this.locks.get(lockKey) || null;
  }

  /**
   * Get all active locks (for debugging/monitoring)
   */
  getAllLocks(): DeploymentLock[] {
    return Array.from(this.locks.values());
  }

  /**
   * Get the count of active locks
   */
  getActiveLockCount(): number {
    return this.locks.size;
  }

  /**
   * Clean up resources on service destruction
   */
  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.locks.clear();
  }
}
