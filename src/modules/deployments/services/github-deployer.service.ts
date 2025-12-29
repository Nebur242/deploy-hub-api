/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Octokit } from '@octokit/rest';

import { ServiceCreateDeploymentDto } from '../dto/create-deployment.dto';
import { GitHubAccount } from '../dto/github-account.dto';
import { Deployment } from '../entities/deployment.entity';
import { retryWithBackoff, isGitHubRetryableError } from '../utils/retry-with-backoff.util';

@Injectable()
export class GithubDeployerService {
  private readonly logger = new Logger(GithubDeployerService.name);
  private readonly maxRetries = 3;

  /**
   * Deploy to GitHub Actions using a specific GitHub account
   * Uses retry with backoff for resilience against transient failures
   */
  async deployToGitHub(
    deployment: Deployment,
    githubAccount: GitHubAccount,
    deploymentConfig: ServiceCreateDeploymentDto,
  ): Promise<{ workflowRunId: number }> {
    this.logger.log(`[GITHUB] Starting deployToGitHub for deployment ${deployment.id}`);
    this.logger.log(
      `[GITHUB] Account: ${githubAccount.username}, Repo: ${githubAccount.repository}`,
    );
    this.logger.log(
      `[GITHUB] Workflow file: ${githubAccount.workflow_file}, Branch: ${deploymentConfig.branch}`,
    );
    this.logger.log(`[GITHUB] Token length: ${githubAccount.access_token?.length || 0} chars`);

    const octokit = new Octokit({ auth: githubAccount.access_token });

    // Get the workflow ID with retry
    this.logger.log(`[GITHUB] Step 1: Getting workflow ID...`);
    const workflowIdResult = await retryWithBackoff(
      () => this.getWorkflowId(octokit, githubAccount),
      {
        maxRetries: this.maxRetries,
        isRetryable: isGitHubRetryableError,
        logger: this.logger,
        context: `getWorkflowId(${githubAccount.username}/${githubAccount.repository})`,
      },
    );

    if (!workflowIdResult.success) {
      this.logger.error(`[GITHUB] Failed to get workflow ID: ${workflowIdResult.error?.message}`);
      throw workflowIdResult.error || new Error('Failed to get workflow ID');
    }

    const workflowId = workflowIdResult.data!;
    this.logger.log(`[GITHUB] Workflow ID found: ${workflowId}`);

    // Get existing workflow runs BEFORE triggering new one (with retry)
    this.logger.log(`[GITHUB] Step 2: Getting existing workflow runs...`);
    const existingRunsResult = await retryWithBackoff(
      () =>
        this.getExistingWorkflowRunIds(
          octokit,
          githubAccount.username,
          githubAccount.repository,
          workflowId,
        ),
      {
        maxRetries: this.maxRetries,
        isRetryable: isGitHubRetryableError,
        logger: this.logger,
        context: 'getExistingWorkflowRunIds',
      },
    );

    if (!existingRunsResult.success) {
      this.logger.error(
        `[GITHUB] Failed to get existing runs: ${existingRunsResult.error?.message}`,
      );
      throw existingRunsResult.error || new Error('Failed to get existing workflow runs');
    }

    const existingRunIds = existingRunsResult.data!;
    this.logger.log(`[GITHUB] Found ${existingRunIds.size} existing workflow runs`);

    // Prepare workflow inputs based on deployment provider
    const inputs: Record<string, string> = {
      BRANCH: deployment.branch,
      ENVIRONMENT: deployment.environment,
    };

    // Add environment variables as inputs
    deploymentConfig.environment_variables.forEach(env => {
      inputs[env.key] = env.default_value;
    });
    this.logger.log(
      `[GITHUB] Prepared ${Object.keys(inputs).length} workflow inputs: ${Object.keys(inputs).join(', ')}`,
    );

    // Record timestamp before triggering
    const triggerTime = new Date();
    this.logger.log(`[GITHUB] Step 3: Dispatching workflow at ${triggerTime.toISOString()}...`);

    // Trigger the workflow with retry
    const dispatchResult = await retryWithBackoff(
      () =>
        octokit.actions.createWorkflowDispatch({
          owner: githubAccount.username,
          repo: githubAccount.repository,
          workflow_id: workflowId,
          ref: deploymentConfig.branch,
          inputs,
        }),
      {
        maxRetries: this.maxRetries,
        isRetryable: isGitHubRetryableError,
        logger: this.logger,
        context: 'createWorkflowDispatch',
      },
    );

    if (!dispatchResult.success) {
      this.logger.error(
        `[GITHUB] Failed to trigger workflow after ${dispatchResult.attempts} attempts: ${dispatchResult.error?.message}`,
      );
      throw dispatchResult.error || new Error('Failed to trigger workflow');
    }
    this.logger.log(
      `[GITHUB] Workflow dispatched successfully after ${dispatchResult.attempts} attempt(s)`,
    );

    // Get the exact new workflow run ID (with retry)
    this.logger.log(`[GITHUB] Step 4: Waiting for new workflow run to appear...`);
    const runIdResult = await retryWithBackoff(
      () =>
        this.getNewWorkflowRunId(
          octokit,
          githubAccount.username,
          githubAccount.repository,
          workflowId,
          existingRunIds,
          triggerTime,
        ),
      {
        maxRetries: 5, // More retries for finding new run as it may take time to appear
        baseDelayMs: 2000, // Longer delay to allow GitHub to register the run
        isRetryable: isGitHubRetryableError,
        logger: this.logger,
        context: 'getNewWorkflowRunId',
      },
    );

    if (!runIdResult.success) {
      this.logger.error(
        `[GITHUB] Failed to get new workflow run ID: ${runIdResult.error?.message}`,
      );
      throw runIdResult.error || new Error('Failed to get new workflow run ID');
    }

    this.logger.log(`[GITHUB] New workflow run found: ${runIdResult.data!}`);
    return { workflowRunId: runIdResult.data! };
  }

  /**
   * Get workflow ID with multiple fallback strategies
   */
  private async getWorkflowId(octokit: Octokit, githubAccount: GitHubAccount): Promise<number> {
    this.logger.log(
      `[GITHUB] Listing workflows for ${githubAccount.username}/${githubAccount.repository}...`,
    );
    const { data: workflows } = await octokit.actions.listRepoWorkflows({
      owner: githubAccount.username,
      repo: githubAccount.repository,
    });

    // Strategy 1: Find by exact path match
    const workflowPath = `.github/workflows/${githubAccount.workflow_file}`;
    let workflow = workflows.workflows.find(w => w.path === workflowPath);

    if (workflow) {
      this.logger.log(`Found workflow by path: ${workflowPath}`);
      return workflow.id;
    }

    // Strategy 2: Find by filename only (in case path structure differs)
    workflow = workflows.workflows.find(w => w.path?.endsWith(`/${githubAccount.workflow_file}`));

    if (workflow) {
      this.logger.log(`Found workflow by filename: ${githubAccount.workflow_file}`);
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
      const octokit = new Octokit({ auth: githubAccount.access_token });
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
    account: { username: string; access_token: string; repository: string },
    runId: number,
  ): Promise<string> {
    this.logger.log(`[LOGS] Getting logs for workflow run ${runId}`);
    const octokit = new Octokit({ auth: account.access_token });

    try {
      // Get the jobs for this workflow run
      this.logger.log(`[LOGS] Fetching jobs for run ${runId}...`);
      const { data: jobsResponse } = await octokit.actions.listJobsForWorkflowRun({
        owner: account.username,
        repo: account.repository,
        run_id: runId,
      });

      this.logger.log(`[LOGS] Found ${jobsResponse.jobs.length} jobs`);

      if (jobsResponse.jobs.length === 0) {
        return 'No jobs found for this workflow run';
      }

      // Build a formatted log output from job steps
      const logLines: string[] = [];
      logLines.push(`=== Workflow Run ${runId} ===\n`);

      for (const job of jobsResponse.jobs) {
        logLines.push(`\n--- Job: ${job.name} ---`);
        logLines.push(`Status: ${job.status}`);
        logLines.push(`Conclusion: ${job.conclusion || 'in progress'}`);
        logLines.push(`Started: ${job.started_at || 'N/A'}`);
        logLines.push(`Completed: ${job.completed_at || 'N/A'}`);
        logLines.push('');

        if (job.steps && job.steps.length > 0) {
          logLines.push('Steps:');
          for (const step of job.steps) {
            const statusIcon =
              step.conclusion === 'success'
                ? '✓'
                : step.conclusion === 'failure'
                  ? '✗'
                  : step.conclusion === 'skipped'
                    ? '○'
                    : '●';
            logLines.push(`  ${statusIcon} ${step.name} (${step.conclusion || step.status})`);
            if (step.started_at) {
              logLines.push(`      Started: ${step.started_at}`);
            }
            if (step.completed_at) {
              logLines.push(`      Completed: ${step.completed_at}`);
            }
          }
        }
        logLines.push('');
      }

      // Try to get detailed logs from the first job
      const firstJob = jobsResponse.jobs[0];
      this.logger.log(`[LOGS] Attempting to fetch detailed logs for job ${firstJob.id}...`);

      try {
        // Use the raw request to get logs with proper redirect handling
        const response = await octokit.request(
          'GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs',
          {
            owner: account.username,
            repo: account.repository,
            job_id: firstJob.id,
            request: {
              // Follow redirects and get the actual content
              redirect: 'follow',
            },
          },
        );

        if (typeof response.data === 'string' && response.data.length > 0) {
          this.logger.log(`[LOGS] Got detailed logs, length: ${response.data.length}`);
          logLines.push('\n=== Detailed Logs ===\n');
          logLines.push(response.data);
        }
      } catch (detailedLogsError) {
        this.logger.warn(`[LOGS] Could not fetch detailed logs: ${detailedLogsError.message}`);
        // Continue without detailed logs - the step summary is still useful
      }

      const formattedLogs = logLines.join('\n');
      this.logger.log(`[LOGS] Returning formatted logs, total length: ${formattedLogs.length}`);
      return formattedLogs;
    } catch (error) {
      this.logger.error(`[LOGS] Error getting workflow logs: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check workflow run status
   */
  async checkWorkflowStatus(
    account: { username: string; access_token: string; repository: string },
    runId: number,
  ): Promise<{ status: string; conclusion: string | null; deploymentUrl?: string }> {
    const octokit = new Octokit({ auth: account.access_token });

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
          deploymentUrl = this.extractDeploymentUrl(logs);
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

  /**
   * Extract deployment URL from workflow logs
   * Supports multiple patterns for Vercel, Netlify, and custom outputs
   */
  private extractDeploymentUrl(logs: string): string {
    // Priority order of URL patterns to match
    const patterns = [
      // Standard pattern with emoji (recommended)
      /🔗\s*Deployment URL:\s*(https:\/\/[^\s\n]+)/i,
      // Without emoji
      /Deployment URL:\s*(https:\/\/[^\s\n]+)/i,
      // Vercel specific patterns
      /Preview:\s*(https:\/\/[^\s\n]*\.vercel\.app[^\s\n]*)/i,
      /Production:\s*(https:\/\/[^\s\n]*\.vercel\.app[^\s\n]*)/i,
      /Deployed to:\s*(https:\/\/[^\s\n]*\.vercel\.app[^\s\n]*)/i,
      /https:\/\/[a-zA-Z0-9-]+\.vercel\.app/,
      // Netlify specific patterns
      /Website URL:\s*(https:\/\/[^\s\n]*\.netlify\.app[^\s\n]*)/i,
      /Deploy URL:\s*(https:\/\/[^\s\n]*\.netlify\.app[^\s\n]*)/i,
      /Unique Deploy URL:\s*(https:\/\/[^\s\n]+)/i,
      /https:\/\/[a-zA-Z0-9-]+\.netlify\.app/,
      // Generic deployment URL patterns
      /Live URL:\s*(https:\/\/[^\s\n]+)/i,
      /Site URL:\s*(https:\/\/[^\s\n]+)/i,
      /Published to:\s*(https:\/\/[^\s\n]+)/i,
    ];

    for (const pattern of patterns) {
      const match = logs.match(pattern);
      if (match) {
        // Get the captured group (URL) or the full match
        const url = match[1] || match[0];
        // Clean up the URL (remove trailing punctuation, quotes, etc.)
        const cleanUrl = url.replace(/['")\]}>]+$/, '').trim();
        this.logger.log(`[URL] Extracted deployment URL: ${cleanUrl}`);
        return cleanUrl;
      }
    }

    this.logger.warn('[URL] No deployment URL found in logs');
    return '';
  }

  /**
   * Cancel a running workflow run
   */
  async cancelWorkflowRun(
    account: { username: string; access_token: string; repository: string },
    runId: number,
  ): Promise<{ success: boolean; message: string }> {
    const octokit = new Octokit({ auth: account.access_token });

    try {
      // First check if the workflow is still running
      const { data: run } = await octokit.actions.getWorkflowRun({
        owner: account.username,
        repo: account.repository,
        run_id: runId,
      });

      // Can only cancel workflows that are in progress or queued
      if (run.status !== 'in_progress' && run.status !== 'queued') {
        return {
          success: false,
          message: `Cannot cancel workflow. Current status: ${run.status}`,
        };
      }

      // Cancel the workflow run
      await octokit.actions.cancelWorkflowRun({
        owner: account.username,
        repo: account.repository,
        run_id: runId,
      });

      this.logger.log(`Successfully cancelled workflow run ${runId}`);

      return {
        success: true,
        message: 'Workflow run cancelled successfully',
      };
    } catch (error) {
      this.logger.error(`Error cancelling workflow run: ${error.message}`);
      return {
        success: false,
        message: `Failed to cancel workflow: ${error.message}`,
      };
    }
  }
}
