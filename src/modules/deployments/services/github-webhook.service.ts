/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';
import * as crypto from 'crypto';

interface WebhookCreationResult {
  success: boolean;
  hookId?: number;
  message?: string;
}

@Injectable()
export class GithubWebhookService {
  private readonly logger = new Logger(GithubWebhookService.name);
  private readonly webhookSecret: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    // Generate a deployment-specific webhook secret or use a configured one
    this.webhookSecret =
      this.configService.get<string>('GITHUB_WEBHOOK_SECRET') ||
      crypto.randomBytes(32).toString('hex');

    // Get the base URL for the webhook callbacks
    this.baseUrl = this.configService.get<string>('API_BASE_URL', 'http://localhost:3000/api/v1');
  }

  /**
   * Create a deployment-specific webhook for a GitHub repository
   *
   * @param repositoryOwner GitHub repository owner/org
   * @param repositoryName GitHub repository name
   * @param accessToken GitHub access token with admin:repo_hook permissions
   * @param deploymentId Our internal deployment ID to track
   * @returns Result object with success status and webhook ID if created
   */
  async createDeploymentWebhook(
    repositoryOwner: string,
    repositoryName: string,
    accessToken: string,
    deploymentId: string,
  ): Promise<WebhookCreationResult> {
    try {
      const octokit = new Octokit({ auth: accessToken });

      // Create webhook configuration
      const webhookUrl = `${this.baseUrl}/webhooks/github/workflow-run`;

      // Check if webhook with this URL already exists to avoid duplicates
      const { data: existingHooks } = await octokit.repos.listWebhooks({
        owner: repositoryOwner,
        repo: repositoryName,
      });

      const existingHook = existingHooks.find(
        hook => hook.config && hook.config.url && hook.config.url === webhookUrl,
      );

      if (existingHook) {
        this.logger.log(
          `Using existing webhook ${existingHook.id} for deployment ${deploymentId} in ${repositoryOwner}/${repositoryName}`,
        );
        return {
          success: true,
          hookId: existingHook.id,
          message: 'Using existing webhook',
        };
      }

      // Create new webhook
      const { data: webhook } = await octokit.repos.createWebhook({
        owner: repositoryOwner,
        repo: repositoryName,
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: this.webhookSecret,
          insecure_ssl: '0',
        },
        events: ['workflow_run'],
        active: true,
      });

      this.logger.log(
        `Created webhook ${webhook.id} for deployment ${deploymentId} in ${repositoryOwner}/${repositoryName}`,
      );

      return {
        success: true,
        hookId: webhook.id,
        message: 'Webhook created successfully',
      };
    } catch (error) {
      this.logger.error(
        `Failed to create webhook for deployment ${deploymentId}: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        message: `Failed to create webhook: ${error.message}`,
      };
    }
  }

  /**
   * Delete a deployment webhook when it's no longer needed
   *
   * @param repositoryOwner GitHub repository owner/org
   * @param repositoryName GitHub repository name
   * @param accessToken GitHub access token with admin:repo_hook permissions
   * @param hookId ID of the webhook to delete
   * @returns Success status
   */
  async deleteDeploymentWebhook(
    repositoryOwner: string,
    repositoryName: string,
    accessToken: string,
    hookId: number,
  ): Promise<boolean> {
    try {
      const octokit = new Octokit({ auth: accessToken });

      await octokit.repos.deleteWebhook({
        owner: repositoryOwner,
        repo: repositoryName,
        hook_id: hookId,
      });

      this.logger.log(`Deleted webhook ${hookId} from ${repositoryOwner}/${repositoryName}`);

      return true;
    } catch (error) {
      this.logger.error(`Failed to delete webhook ${hookId}: ${error.message}`, error.stack);
      return false;
    }
  }

  /**
   * Extracts repository owner and name from a full repository string
   * Example: "octocat/hello-world" → { owner: "octocat", name: "hello-world" }
   */
  extractRepositoryInfo(repositoryFullName: string): { owner: string; name: string } {
    const parts = repositoryFullName.split('/');
    if (parts.length !== 2) {
      throw new Error(
        `Invalid repository format: ${repositoryFullName}. Expected format: owner/name`,
      );
    }

    return {
      owner: parts[0],
      name: parts[1],
    };
  }
}
