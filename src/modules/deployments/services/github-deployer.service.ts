/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
    try {
      const octokit = new Octokit({ auth: githubAccount.accessToken });

      // Get the workflow ID with improved error handling
      const workflowId = await this.getWorkflowId(octokit, githubAccount);

      // Get existing workflow runs BEFORE triggering new one
      const existingRunIds = await this.getExistingWorkflowRunIds(
        octokit,
        githubAccount.username,
        githubAccount.repository,
        workflowId,
      );

      // Prepare workflow inputs based on deployment provider
      const inputs: Record<string, string> = {
        BRANCH: deployment.branch,
        ENVIRONMENT: deployment.environment,
      };

      // Add environment variables as inputs
      deploymentConfig.environmentVariables.forEach(env => {
        inputs[env.key] = env.defaultValue;
      });

      // Record timestamp before triggering
      const triggerTime = new Date();

      // Trigger the workflow
      await octokit.actions.createWorkflowDispatch({
        owner: githubAccount.username,
        repo: githubAccount.repository,
        workflow_id: workflowId,
        ref: deploymentConfig.branch,
        inputs,
      });

      // Get the exact new workflow run ID
      const runId = await this.getNewWorkflowRunId(
        octokit,
        githubAccount.username,
        githubAccount.repository,
        workflowId,
        existingRunIds,
        triggerTime,
      );

      return { workflowRunId: runId };
    } catch (error) {
      console.log('Error deploying to GitHub:', error);
      this.logger.error(`Error deploying to GitHub: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get workflow ID with multiple fallback strategies
   */
  private async getWorkflowId(octokit: Octokit, githubAccount: GitHubAccount): Promise<number> {
    const { data: workflows } = await octokit.actions.listRepoWorkflows({
      owner: githubAccount.username,
      repo: githubAccount.repository,
    });

    // Strategy 1: Find by exact path match
    const workflowPath = `.github/workflows/${githubAccount.workflowFile}`;
    let workflow = workflows.workflows.find(w => w.path === workflowPath);

    if (workflow) {
      this.logger.log(`Found workflow by path: ${workflowPath}`);
      return workflow.id;
    }

    // Strategy 2: Find by filename only (in case path structure differs)
    workflow = workflows.workflows.find(w => w.path?.endsWith(`/${githubAccount.workflowFile}`));

    if (workflow) {
      this.logger.log(`Found workflow by filename: ${githubAccount.workflowFile}`);
      return workflow.id;
    }

    // Strategy 3: Find by common deployment workflow names
    const commonDeploymentNames = [
      'Deploy to Vercel',
      'Deploy',
      'Deployment',
      'CI/CD',
      'Build and Deploy',
      'Production Deploy',
    ];

    for (const name of commonDeploymentNames) {
      workflow = workflows.workflows.find(w => w.name?.toLowerCase().includes(name.toLowerCase()));
      if (workflow) {
        this.logger.log(`Found workflow by name pattern: ${workflow.name}`);
        return workflow.id;
      }
    }

    // Strategy 4: If only one workflow exists, use it
    if (workflows.workflows.length === 1) {
      this.logger.log(`Using single available workflow: ${workflows.workflows[0].name}`);
      return workflows.workflows[0].id;
    }

    // Strategy 5: Look for workflows with 'workflow_dispatch' trigger
    const dispatchableWorkflows = workflows.workflows.filter(w => {
      // This would require fetching individual workflow content,
      // but we can make an educated guess based on common patterns
      return w.name?.toLowerCase().includes('deploy') || w.name?.toLowerCase().includes('dispatch');
    });

    if (dispatchableWorkflows.length === 1) {
      this.logger.log(`Found dispatchable workflow: ${dispatchableWorkflows[0].name}`);
      return dispatchableWorkflows[0].id;
    }

    // Strategy 6: Cache and store workflow ID for future use
    // You might want to implement a caching mechanism here

    // If all strategies fail, provide detailed error information
    const availableWorkflows = workflows.workflows.map(w => ({
      id: w.id,
      name: w.name,
      path: w.path,
      state: w.state,
    }));

    this.logger.error(`Available workflows: ${JSON.stringify(availableWorkflows, null, 2)}`);

    throw new NotFoundException(
      `Workflow not found. Searched for: ${workflowPath}. ` +
        `Available workflows: ${availableWorkflows.map(w => w.name || w.path).join(', ')}`,
    );
  }

  /**
   * Get existing workflow run IDs before triggering a new one
   */
  private async getExistingWorkflowRunIds(
    octokit: Octokit,
    owner: string,
    repo: string,
    workflowId: number,
  ): Promise<Set<number>> {
    try {
      const { data: runs } = await octokit.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: workflowId,
        per_page: 50, // Get enough to avoid missing any recent runs
        event: 'workflow_dispatch',
      });

      return new Set(runs.workflow_runs.map(run => run.id));
    } catch (error) {
      this.logger.warn(`Error getting existing workflow runs: ${error.message}`);
      return new Set(); // Return empty set if we can't get existing runs
    }
  }

  /**
   * Get the new workflow run ID that was just created
   */
  private async getNewWorkflowRunId(
    octokit: Octokit,
    owner: string,
    repo: string,
    workflowId: number,
    existingRunIds: Set<number>,
    triggerTime: Date,
  ): Promise<number> {
    const maxAttempts = 10;
    const baseDelay = 1000; // 1 second
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const { data: runs } = await octokit.actions.listWorkflowRuns({
          owner,
          repo,
          workflow_id: workflowId,
          per_page: 20,
          event: 'workflow_dispatch',
        });

        // Find runs that:
        // 1. Don't exist in our pre-trigger set
        // 2. Were created after our trigger time (with some buffer for clock skew)
        const bufferTime = new Date(triggerTime.getTime() - 30000); // 30 second buffer

        const newRuns = runs.workflow_runs.filter(run => {
          const runCreatedAt = new Date(run.created_at);
          return !existingRunIds.has(run.id) && runCreatedAt >= bufferTime;
        });

        if (newRuns.length > 0) {
          // Sort by creation time to get the most recent
          newRuns.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          );

          const selectedRun = newRuns[0];
          this.logger.log(
            `Found new workflow run ${selectedRun.id} created at ${selectedRun.created_at} ` +
              `(trigger time: ${triggerTime.toISOString()})`,
          );

          return selectedRun.id;
        }

        // If no new run found, wait with exponential backoff
        if (attempt < maxAttempts) {
          const delay = Math.min(baseDelay * Math.pow(1.5, attempt - 1), 8000); // Max 8 seconds
          this.logger.log(
            `No new workflow run found, retrying in ${delay}ms (attempt ${attempt}/${maxAttempts})`,
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) {
          const delay = Math.min(baseDelay * Math.pow(1.5, attempt - 1), 8000);
          this.logger.warn(
            `Error checking for new workflow run, retrying in ${delay}ms: ${error.message}`,
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Fallback: If we still can't find the exact run, try to get the most recent one
    // that was created after our trigger time
    try {
      const { data: runs } = await octokit.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id: workflowId,
        per_page: 10,
        event: 'workflow_dispatch',
      });

      const recentRuns = runs.workflow_runs.filter(
        run => new Date(run.created_at) >= new Date(triggerTime.getTime() - 60000), // 1 minute buffer
      );

      if (recentRuns.length > 0) {
        const fallbackRun = recentRuns[0];
        this.logger.warn(
          `Using fallback workflow run ${fallbackRun.id} created at ${fallbackRun.created_at}`,
        );
        return fallbackRun.id;
      }
    } catch (fallbackError) {
      this.logger.error(`Fallback strategy failed: ${fallbackError.message}`);
    }

    throw new Error(
      `Failed to identify the triggered workflow run after ${maxAttempts} attempts. ` +
        `Trigger time: ${triggerTime.toISOString()}. ` +
        `Last error: ${lastError?.message || 'No matching workflow run found'}`,
    );
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
        per_page: 10, // Get more runs to find the most recent one
        event: 'workflow_dispatch', // Only get manually triggered runs
      });

      if (runs.workflow_runs.length === 0) {
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return this.getLatestWorkflowRunId(octokit, owner, repo, workflowId, retries - 1);
        }
        return null;
      }

      // Sort by created_at to ensure we get the most recent
      const sortedRuns = runs.workflow_runs.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      return sortedRuns[0].id;
    } catch (error) {
      if (retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return this.getLatestWorkflowRunId(octokit, owner, repo, workflowId, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Validate that a workflow can be dispatched
   */
  async validateWorkflowDispatchable(
    githubAccount: GitHubAccount,
  ): Promise<{ valid: boolean; workflowId?: number; error?: string }> {
    try {
      const octokit = new Octokit({ auth: githubAccount.accessToken });
      const workflowId = await this.getWorkflowId(octokit, githubAccount);

      // Try to get workflow details to ensure it exists and is accessible
      const { data: workflow } = await octokit.actions.getWorkflow({
        owner: githubAccount.username,
        repo: githubAccount.repository,
        workflow_id: workflowId,
      });

      if (workflow.state !== 'active') {
        return {
          valid: false,
          error: `Workflow is not active (state: ${workflow.state})`,
        };
      }

      return {
        valid: true,
        workflowId: workflowId,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
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
