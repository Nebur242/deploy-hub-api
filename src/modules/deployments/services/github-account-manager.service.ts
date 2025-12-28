import { EncryptionService } from '@app/shared/encryption/encryption.service';
import { Injectable, Logger } from '@nestjs/common';

import { Deployment } from '../entities/deployment.entity';
import { GitHubAccountWithMetadata } from '../types/deployment.types';

/**
 * Base GitHub account configuration (stored in project configuration)
 */
export interface BaseGitHubAccount {
  username: string;
  access_token: string;
  repository: string;
  workflow_file: string;
}

/**
 * Service for managing GitHub accounts used in deployments
 * Handles encryption/decryption and round-robin account selection
 */
@Injectable()
export class GitHubAccountManagerService {
  private readonly logger = new Logger(GitHubAccountManagerService.name);

  constructor(private readonly encryptionService: EncryptionService) {}

  /**
   * Prepare GitHub accounts with metadata for deployment
   * Decrypts access tokens and adds runtime metadata
   */
  prepareAccountsForDeployment(accounts: BaseGitHubAccount[]): GitHubAccountWithMetadata[] {
    return accounts.map(account => ({
      ...account,
      access_token: this.encryptionService.decrypt(account.access_token),
      available: true,
      failureCount: 0,
      lastUsed: new Date(),
    }));
  }

  /**
   * Prepare accounts with metadata but keep tokens encrypted
   * Used for creating account objects to store in deployment records
   */
  prepareAccountsWithEncryptedTokens(accounts: BaseGitHubAccount[]): GitHubAccountWithMetadata[] {
    return accounts.map(account => ({
      ...account,
      available: true,
      failureCount: 0,
      lastUsed: new Date(),
    }));
  }

  /**
   * Encrypt a GitHub account's access token
   * Used before storing account info in deployment records
   */
  encryptAccountToken(account: GitHubAccountWithMetadata): GitHubAccountWithMetadata {
    return {
      ...account,
      access_token: this.encryptionService.encrypt(account.access_token),
    };
  }

  /**
   * Decrypt a GitHub account's access token
   * Used when reading account info from deployment records
   */
  decryptAccountToken(account: GitHubAccountWithMetadata): GitHubAccountWithMetadata {
    return {
      ...account,
      access_token: this.encryptionService.decrypt(account.access_token),
    };
  }

  /**
   * Get the decrypted access token from a deployment's GitHub account
   */
  getDecryptedToken(deployment: Deployment): string | null {
    if (!deployment.github_account?.access_token) {
      return null;
    }
    return this.encryptionService.decrypt(deployment.github_account.access_token);
  }

  /**
   * Order GitHub accounts for round-robin deployment
   * Returns accounts starting from the next one after the last used account
   */
  getOrderedAccountsForDeployment(
    accounts: BaseGitHubAccount[],
    recentDeployments: Deployment[],
  ): GitHubAccountWithMetadata[] {
    const preparedAccounts = this.prepareAccountsForDeployment(accounts);

    // If there's only one account or no recent deployments, return as-is
    if (preparedAccounts.length <= 1 || recentDeployments.length === 0) {
      return [...preparedAccounts];
    }

    // Find the last used account
    let startIndex = 0;
    const lastDeployment = recentDeployments[0];

    if (lastDeployment?.github_account?.username) {
      const lastUsername = lastDeployment.github_account.username;
      const lastIndex = preparedAccounts.findIndex(a => a.username === lastUsername);

      if (lastIndex !== -1) {
        // Start with the next account in the sequence (round-robin)
        startIndex = (lastIndex + 1) % preparedAccounts.length;
      }
    }

    // Reorder accounts to implement round-robin
    return [...preparedAccounts.slice(startIndex), ...preparedAccounts.slice(0, startIndex)];
  }

  /**
   * Order GitHub accounts for retry, prioritizing accounts that haven't failed
   * Skips the last failed account if possible
   */
  getOrderedAccountsForRetry(
    accounts: BaseGitHubAccount[],
    recentDeployments: Deployment[],
    lastFailedUsername?: string,
  ): GitHubAccountWithMetadata[] {
    const preparedAccounts = this.prepareAccountsForDeployment(accounts);

    // If no failed account or only one account, use default ordering
    if (!lastFailedUsername || preparedAccounts.length <= 1) {
      return this.getOrderedAccountsForDeployment(accounts, recentDeployments);
    }

    // Find the failed account index
    const failedIndex = preparedAccounts.findIndex(a => a.username === lastFailedUsername);

    if (failedIndex === -1) {
      return this.getOrderedAccountsForDeployment(accounts, recentDeployments);
    }

    // Start with the next account after the failed one
    const startIndex = (failedIndex + 1) % preparedAccounts.length;

    return [...preparedAccounts.slice(startIndex), ...preparedAccounts.slice(0, startIndex)];
  }

  /**
   * Select the best account for deployment
   * Currently returns the first account from ordered list
   */
  selectAccountForDeployment(
    orderedAccounts: GitHubAccountWithMetadata[],
  ): GitHubAccountWithMetadata | null {
    if (orderedAccounts.length === 0) {
      this.logger.warn('No GitHub accounts available for deployment');
      return null;
    }

    return orderedAccounts[0];
  }

  /**
   * Validate that accounts are available for deployment
   */
  validateAccountsAvailable(accounts: BaseGitHubAccount[]): boolean {
    if (!accounts || accounts.length === 0) {
      this.logger.error('No GitHub accounts configured for deployment');
      return false;
    }

    return true;
  }

  /**
   * Create account info for storing in deployment record
   * Encrypts the access token
   */
  createDeploymentAccountInfo(account: GitHubAccountWithMetadata): GitHubAccountWithMetadata {
    return {
      ...account,
      access_token: this.encryptionService.encrypt(account.access_token),
    };
  }
}
