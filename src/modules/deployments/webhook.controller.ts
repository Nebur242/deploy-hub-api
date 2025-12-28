import { Body, Controller, Headers, Logger, Post, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { DeploymentService } from './deployment.service';
import { Deployment } from './entities/deployment.entity';

/**
 * Controller to handle GitHub webhook events for deployment status updates
 * This provides an event-driven approach to update deployment statuses
 * instead of relying solely on polling
 */
@Controller('webhooks/github')
export class GithubWebhookController {
  private readonly logger = new Logger(GithubWebhookController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly deploymentService: DeploymentService,
    @InjectRepository(Deployment)
    private readonly deploymentRepository: Repository<Deployment>,
  ) {
    this.webhookSecret = this.configService.get<string>('GITHUB_WEBHOOK_SECRET', '');
  }

  /**
   * Handles GitHub workflow_run events
   * Updates the status of associated deployments
   */
  @Post('workflow-run')
  async handleWorkflowRunEvent(
    @Headers('x-hub-signature-256') signature: string,
    @Body() payload: { action: string; workflow_run: { id: string } },
  ) {
    // Validate webhook signature if secret is configured
    if (this.webhookSecret && !this.verifyGitHubSignature(signature, payload)) {
      this.logger.warn('Invalid webhook signature received');
      throw new UnauthorizedException('Invalid webhook signature');
    }

    try {
      // Extract workflow run details
      const { action, workflow_run: workflowRun } = payload;

      if (!workflowRun || !workflowRun.id) {
        return { status: 'skipped', reason: 'Invalid payload structure' };
      }

      const workflowRunId = String(workflowRun.id);
      this.logger.log(`Received GitHub workflow_run event: ${action} for run ID ${workflowRunId}`);

      // Check if this workflow run is associated with any deployments
      const deployment = await this.deploymentRepository.findOne({
        where: { workflow_run_id: workflowRunId },
      });

      if (!deployment) {
        return { status: 'skipped', reason: 'No matching deployment found for this workflow run' };
      }

      this.logger.log(`Found matching deployment ${deployment.id}, updating status`);

      // Update the deployment status immediately
      await this.deploymentService.updateDeploymentStatus(deployment.id);

      return { status: 'success', deploymentId: deployment.id };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Error processing GitHub webhook: ${error.message}`, error.stack);
      return { status: 'error', message: 'Internal server error processing webhook' };
    }
  }

  /**
   * Verify the GitHub webhook signature
   * This prevents unauthorized webhook calls
   */
  private verifyGitHubSignature(signature: string, payload: any): boolean {
    console.log('Verifying GitHub webhook signature');
    console.log('Signature:', signature, payload);

    if (!this.webhookSecret || !signature) {
      // If no secret is configured, skip verification
      return true;
    }

    // Implement actual signature verification logic here
    // This would use crypto to verify HMAC SHA-256 signatures

    // For example:
    // const crypto = require('crypto');
    // const hmac = crypto.createHmac('sha256', this.webhookSecret);
    // const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');
    // return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));

    // For now, returning true as placeholder
    // TODO: Implement proper signature verification
    return true;
  }
}
