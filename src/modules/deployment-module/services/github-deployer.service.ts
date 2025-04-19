/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Injectable, Logger } from '@nestjs/common';
import { Octokit } from '@octokit/rest';

import { ServiceCreateDeploymentDto } from '../dto/create-deployment.dto';
import { GitHubAccount } from '../dto/github-account.dto';
import { Deployment } from '../entities/deployment.entity';

@Injectable()
export class GithubDeployerService {
  private readonly logger = new Logger(GithubDeployerService.name);
  private readonly maxRetries = 3;

  /**
   * Deploy to GitHub Actions using a specific GitHub account
   */
  async deployToGitHub(
    deployment: Deployment,
    githubAccount: GitHubAccount,
    deploymentConfig: ServiceCreateDeploymentDto,
  ): Promise<{ workflowRunId: number }> {
    // Initialize Octokit with the GitHub token
    try {
      const octokit = new Octokit({ auth: githubAccount.accessToken });

      // Get the workflow ID
      const workflowPath = '.github/workflows/deploy.yml';

      // Find the workflow
      const { data: workflows } = await octokit.actions.listRepoWorkflows({
        owner: githubAccount.username,
        repo: githubAccount.repository,
      });

      // Find workflow by path or by name "Deploy to Vercel"
      const workflow = workflows.workflows.find(w => w.path === workflowPath);

      if (!workflow) {
        throw new Error(`Workflow not found: ${workflowPath}`);
      }

      // Prepare workflow inputs based on deployment provider
      const inputs: Record<string, string> = {
        branch: deployment.branch,
        environment: deployment.environment,
      };

      // Add environment variables as inputs
      deploymentConfig.environmentVariables.forEach(env => {
        inputs[env.key] = env.defaultValue;
      });

      // Add deployment metadata for tracking
      inputs.deployment_id = deployment.id;
      inputs.user_id = deployment.ownerId;
      inputs.project_id = deployment.projectId;

      // Trigger the workflow
      await octokit.actions.createWorkflowDispatch({
        owner: githubAccount.username,
        repo: githubAccount.repository,
        workflow_id: workflow.id,
        ref: 'main', // The branch where the workflow file exists
        // inputs,
      });

      // Get the workflow run ID - try multiple times as there can be a delay
      let runId = await this.getLatestWorkflowRunId(
        octokit,
        githubAccount.username,
        githubAccount.repository,
        workflow.id,
      );

      if (!runId) {
        // Wait briefly and try again
        await new Promise(resolve => setTimeout(resolve, 2000));
        runId = await this.getLatestWorkflowRunId(
          octokit,
          githubAccount.username,
          githubAccount.repository,
          workflow.id,
        );

        if (!runId) {
          throw new Error('Workflow triggered but no run was created');
        }
      }

      return { workflowRunId: runId };
    } catch (error) {
      console.log('Error deploying to GitHub:', error);
      this.logger.error(`Error deploying to GitHub: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get the latest workflow run ID with retry
   */
  private async getLatestWorkflowRunId(
    octokit: Octokit,
    owner: string,
    repo: string,
    workflowId: number,
    retries = 2,
  ): Promise<number | null> {
    try {
      const { data: runs } = await octokit.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: workflowId,
        per_page: 1,
      });

      if (runs.workflow_runs.length === 0) {
        if (retries > 0) {
          // Wait briefly and try again
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.getLatestWorkflowRunId(octokit, owner, repo, workflowId, retries - 1);
        }
        return null;
      }

      return runs.workflow_runs[0].id;
    } catch (error) {
      if (retries > 0) {
        // Wait and retry on error
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.getLatestWorkflowRunId(octokit, owner, repo, workflowId, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Get logs for a workflow run
   */
  async getWorkflowLogs(
    account: { username: string; accessToken: string; repository: string },
    runId: number,
  ): Promise<string> {
    const octokit = new Octokit({ auth: account.accessToken });

    try {
      // Get the jobs for this workflow run
      const { data: jobsResponse } = await octokit.actions.listJobsForWorkflowRun({
        owner: account.username,
        repo: account.repository,
        run_id: runId,
      });

      if (jobsResponse.jobs.length === 0) {
        return 'No jobs found for this workflow run';
      }

      // Get the deploy job (usually the only one or the first one)
      const jobId = jobsResponse.jobs[0].id;

      // Get logs for the job
      const response = await octokit.request(
        `GET /repos/${account.username}/${account.repository}/actions/jobs/${jobId}/logs`,
        {
          headers: {
            accept: 'application/json',
          },
        },
      );

      // Convert response to string based on its type
      if (typeof response.data === 'string') {
        return response.data;
      } else if (response.data instanceof ArrayBuffer || response.data instanceof Uint8Array) {
        return new TextDecoder().decode(response.data);
      } else if (response.data && typeof response.data === 'object') {
        return JSON.stringify(response.data);
      }

      return 'Unable to retrieve logs';
    } catch (error) {
      this.logger.error(`Error getting workflow logs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check workflow run status
   */
  async checkWorkflowStatus(
    account: { username: string; accessToken: string; repository: string },
    runId: number,
  ): Promise<{ status: string; conclusion: string | null; deploymentUrl?: string }> {
    const octokit = new Octokit({ auth: account.accessToken });

    try {
      const { data: run } = await octokit.actions.getWorkflowRun({
        owner: account.username,
        repo: account.repository,
        run_id: runId,
      });

      // Extract deployment URL if completed successfully
      let deploymentUrl = '';
      if (run.status === 'completed' && run.conclusion === 'success') {
        try {
          const logs = await this.getWorkflowLogs(account, runId);
          const urlMatch = logs.match(/🔗 Deployment URL: (https:\/\/[^\s]+)/);
          deploymentUrl = urlMatch ? urlMatch[1] : '';
        } catch (error) {
          this.logger.warn(`Error extracting deployment URL: ${error.message}`);
        }
      }

      return {
        status: run.status!,
        conclusion: run.conclusion,
        deploymentUrl,
      };
    } catch (error) {
      this.logger.error(`Error checking workflow status: ${error.message}`);
      throw error;
    }
  }
}
