/* eslint-disable @typescript-eslint/no-unsafe-member-access */

/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * GitHub Account interface
 */
export interface GitHubAccount {
  name: string;
  token: string;
  owner: string;
  repo: string;
  available: boolean;
  failureCount: number;
  lastUsed?: Date;
}

/**
 * User deployment configuration
 */
export interface DeploymentConfig {
  id: string;
  name: string;
  vercelToken: string;
  vercelProjectId: string;
  vercelOrgId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  environment: 'production' | 'preview';
  branch: string;
}

/**
 * Deployment result
 */
export interface DeploymentResult {
  success: boolean;
  userId: string;
  userName: string;
  environment: string;
  account?: string;
  runId?: number;
  deploymentUrl?: string;
  error?: string;
  timestamp: Date;
  status?: string;
  conclusion?: string;
}

/**
 * GitHub deployer service with retry logic and account failover
 */
@Injectable()
export class GithubDeployerService {
  private readonly logger = new Logger(GithubDeployerService.name);
  private accounts: GitHubAccount[] = [];
  private readonly maxRetries = 3;
  private readonly failureThreshold = 5;
  private readonly cooldownPeriod = 10 * 60 * 1000; // 10 minutes in milliseconds

  constructor(private configService: ConfigService) {
    this.loadAccounts();
  }

  /**
   * Load GitHub accounts from configuration
   */
  private loadAccounts(): void {
    try {
      const accountsPath = this.configService.get<string>(
        'GITHUB_ACCOUNTS_PATH',
        'github-accounts.json',
      );
      const accountsFile = fs.readFileSync(path.resolve(accountsPath), 'utf8');
      const rawAccounts = JSON.parse(accountsFile) as GitHubAccount[];

      this.accounts = rawAccounts.map(acc => ({
        ...acc,
        available: true,
        failureCount: 0,
        lastUsed: undefined,
      }));

      this.logger.log(`Loaded ${this.accounts.length} GitHub accounts`);
    } catch (err) {
      const error = err as Error;
      this.logger.error(`Failed to load GitHub accounts: ${error.message}`);
      this.accounts = [];
    }
  }

  /**
   * Get the best available account for deployment
   * Uses a scoring system based on:
   * - Availability status
   * - Failure count
   * - Last used time (for load balancing)
   */
  private getBestAccount(): GitHubAccount | null {
    // Filter out accounts that are marked unavailable
    const availableAccounts = this.accounts.filter(acc => acc.available);

    if (availableAccounts.length === 0) {
      this.logger.warn('No available GitHub accounts found');
      return null;
    }

    // Check for any accounts that had time to cool down after failures
    const now = new Date();
    this.accounts.forEach(acc => {
      if (!acc.available && acc.lastUsed) {
        const timeSinceLastUse = now.getTime() - acc.lastUsed.getTime();
        if (timeSinceLastUse > this.cooldownPeriod) {
          this.logger.log(
            `Account ${acc.owner}/${acc.repo} has cooled down and is now available again`,
          );
          acc.available = true;
          acc.failureCount = Math.max(0, acc.failureCount - 2); // Reduce failure count after cooldown
        }
      }
    });

    // Sort accounts by failure count (ascending) and then by last used time (oldest first)
    return availableAccounts.sort((a, b) => {
      // First sort by failure count
      if (a.failureCount !== b.failureCount) {
        return a.failureCount - b.failureCount;
      }

      // Then sort by last used time (null/undefined values come first)
      if (!a.lastUsed && b.lastUsed) {
        return -1;
      }
      if (a.lastUsed && !b.lastUsed) {
        return 1;
      }
      if (!a.lastUsed && !b.lastUsed) {
        return 0;
      }

      // Both have lastUsed values, so sort by oldest first
      return (a.lastUsed?.getTime() || 0) - (b.lastUsed?.getTime() || 0);
    })[0];
  }

  /**
   * Update account status after a deployment
   */
  private updateAccountStatus(account: GitHubAccount, success: boolean): void {
    account.lastUsed = new Date();

    if (!success) {
      account.failureCount++;
      this.logger.warn(
        `Account ${account.owner}/${account.repo} failure count increased to ${account.failureCount}`,
      );

      // Disable account if it exceeds failure threshold
      if (account.failureCount >= this.failureThreshold) {
        account.available = false;
        this.logger.warn(
          `Account ${account.owner}/${account.repo} marked unavailable due to excessive failures`,
        );
      }
    } else {
      // Reduce failure count on success
      account.failureCount = Math.max(0, account.failureCount - 1);
    }
  }

  /**
   * Create or update workflow in a GitHub repository
   */
  private async setupWorkflow(account: GitHubAccount): Promise<boolean> {
    const octokit = new Octokit({ auth: account.token });
    const workflowPath = '.github/workflows/vercel-deploy.yml';

    const workflowContent = `
name: Vercel Deployment

on:
  workflow_dispatch:
    inputs:
      vercel_token:
        description: 'Vercel API Token'
        required: true
      vercel_project_id:
        description: 'Vercel Project ID'
        required: true
      vercel_org_id:
        description: 'Vercel Organization ID'
        required: true
      supabase_url:
        description: 'Supabase URL'
        required: true
      supabase_anon_key:
        description: 'Supabase Anonymous Key'
        required: true
      environment:
        description: 'Deployment Environment'
        required: true
        default: 'production'
        type: choice
        options:
          - production
          - preview
      branch:
        description: 'Branch to deploy'
        required: true
        default: 'main'
      user_identifier:
        description: 'User Identifier'
        required: false
        default: 'anonymous'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
        with:
          ref: \${{ github.event.inputs.branch }}

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run linting
        run: npm run lint || true

      - name: Run tests
        run: npm test || true

      - name: Install Vercel CLI
        run: npm install --global vercel@latest

      - name: Pull Vercel Environment Information
        run: vercel pull --yes --environment=\${{ github.event.inputs.environment }} --token=\${{ github.event.inputs.vercel_token }}
        env:
          VERCEL_PROJECT_ID: \${{ github.event.inputs.vercel_project_id }}
          VERCEL_ORG_ID: \${{ github.event.inputs.vercel_org_id }}

      - name: Build Project Artifacts
        run: |
          if [ "\${{ github.event.inputs.environment }}" = "production" ]; then
            vercel build --prod --token=\${{ github.event.inputs.vercel_token }}
          else
            vercel build --token=\${{ github.event.inputs.vercel_token }}
          fi
        env:
          VERCEL_PROJECT_ID: \${{ github.event.inputs.vercel_project_id }}
          VERCEL_ORG_ID: \${{ github.event.inputs.vercel_org_id }}
          NEXT_PUBLIC_SUPABASE_URL: \${{ github.event.inputs.supabase_url }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: \${{ github.event.inputs.supabase_anon_key }}

      - name: Deploy to Vercel
        run: |
          if [ "\${{ github.event.inputs.environment }}" = "production" ]; then
            DEPLOYMENT_URL=$(vercel deploy --prebuilt --prod --token=\${{ github.event.inputs.vercel_token }})
          else
            DEPLOYMENT_URL=$(vercel deploy --prebuilt --token=\${{ github.event.inputs.vercel_token }})
          fi
          echo "DEPLOYMENT_URL=$DEPLOYMENT_URL" >> $GITHUB_ENV
        env:
          VERCEL_PROJECT_ID: \${{ github.event.inputs.vercel_project_id }}
          VERCEL_ORG_ID: \${{ github.event.inputs.vercel_org_id }}

      - name: Output Deployment Information
        run: |
          echo "✅ Deployment for \${{ github.event.inputs.user_identifier }} completed!"
          echo "🔗 Deployment URL: $DEPLOYMENT_URL"
          echo "🌎 Environment: \${{ github.event.inputs.environment }}"
          echo "🔄 Branch: \${{ github.event.inputs.branch }}"
`;

    try {
      // Check if the file already exists
      let sha: string = '';
      try {
        const { data: fileData } = await octokit.repos.getContent({
          owner: account.owner,
          repo: account.repo,
          path: workflowPath,
        });
        // Handle the case when response is an array or a single file
        sha = Array.isArray(fileData) ? fileData[0].sha : fileData.sha;
      } catch (err) {
        const error = err as Error;
        console.error(`Error checking workflow file: ${error.message}`);
        // File doesn't exist, proceed with creation
        this.logger.log(`Creating workflow file in ${account.owner}/${account.repo}...`);
      }

      // Create or update workflow file
      await octokit.repos.createOrUpdateFileContents({
        owner: account.owner,
        repo: account.repo,
        path: workflowPath,
        message: sha ? 'Update Vercel deployment workflow' : 'Create Vercel deployment workflow',
        content: Buffer.from(workflowContent).toString('base64'),
        sha,
      });

      return true;
    } catch (error) {
      this.logger.error(
        `Error setting up workflow in ${account.owner}/${account.repo}: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Trigger a workflow for deployment with retry and failover logic
   */
  async triggerDeployment(config: DeploymentConfig, retryCount = 0): Promise<DeploymentResult> {
    // Get best available account
    const account = this.getBestAccount();

    if (!account) {
      return {
        success: false,
        userId: config.id,
        userName: config.name,
        environment: config.environment,
        error: 'No available GitHub accounts',
        timestamp: new Date(),
      };
    }

    try {
      // Ensure workflow is set up in this account
      await this.setupWorkflow(account);

      // Find the workflow
      const octokit = new Octokit({ auth: account.token });
      const { data: workflows } = await octokit.actions.listRepoWorkflows({
        owner: account.owner,
        repo: account.repo,
      });

      const workflow = workflows.workflows.find(
        w =>
          w.name === 'Vercel Deployment' || w.path.includes('.github/workflows/vercel-deploy.yml'),
      );

      if (!workflow) {
        throw new Error(`Workflow not found in ${account.owner}/${account.repo}`);
      }

      // Trigger the workflow
      await octokit.actions.createWorkflowDispatch({
        owner: account.owner,
        repo: account.repo,
        workflow_id: workflow.id,
        ref: 'main', // Branch where the workflow file is located
        inputs: {
          vercel_token: config.vercelToken,
          vercel_project_id: config.vercelProjectId,
          vercel_org_id: config.vercelOrgId,
          supabase_url: config.supabaseUrl,
          supabase_anon_key: config.supabaseAnonKey,
          environment: config.environment,
          branch: config.branch,
          user_identifier: config.name,
        },
      });

      // Get the workflow run ID
      const { data: runs } = await octokit.actions.listWorkflowRuns({
        owner: account.owner,
        repo: account.repo,
        workflow_id: workflow.id,
        per_page: 1,
      });

      const runId = runs.workflow_runs[0]?.id;

      // Update account status - success
      this.updateAccountStatus(account, true);

      this.logger.log(
        `Deployment triggered for ${config.name} via ${account.owner}/${account.repo} - Run ID: ${runId}`,
      );

      return {
        success: true,
        userId: config.id,
        userName: config.name,
        environment: config.environment,
        account: `${account.owner}/${account.repo}`,
        runId,
        timestamp: new Date(),
      };
    } catch (error) {
      // Update account status - failure
      this.updateAccountStatus(account, false);

      this.logger.error(
        `Deployment failed for ${config.name} via ${account.owner}/${account.repo}: ${error.message}`,
      );

      // Retry logic - try with a different account if available
      if (retryCount < this.maxRetries) {
        this.logger.log(
          `Retrying deployment for ${config.name} (Attempt ${retryCount + 1}/${this.maxRetries})`,
        );
        return this.triggerDeployment(config, retryCount + 1);
      }

      return {
        success: false,
        userId: config.id,
        userName: config.name,
        environment: config.environment,
        account: `${account.owner}/${account.repo}`,
        error: error.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check the status of a deployment
   */
  public async checkDeploymentStatus(result: DeploymentResult): Promise<DeploymentResult> {
    if (!result.success || !result.account || !result.runId) {
      return result;
    }

    try {
      const [owner, repo] = result.account.split('/');
      const account = this.accounts.find(a => a.owner === owner && a.repo === repo);

      if (!account) {
        throw new Error(`Account ${result.account} not found`);
      }

      const octokit = new Octokit({ auth: account.token });
      const { data: run } = await octokit.actions.getWorkflowRun({
        owner,
        repo,
        run_id: result.runId,
      });

      // Update result with current status
      return {
        ...result,
        status: run.status!,
        conclusion: run.conclusion!,
        deploymentUrl:
          run.conclusion === 'success'
            ? await this.extractDeploymentUrl(owner, repo, result.runId, account.token)
            : undefined,
      };
    } catch (error) {
      this.logger.error(`Error checking deployment status: ${error.message}`);
      return result;
    }
  }

  /**
   * Extract deployment URL from workflow logs
   */
  private async extractDeploymentUrl(
    owner: string,
    repo: string,
    runId: number,
    token: string,
  ): Promise<string | undefined> {
    try {
      const octokit = new Octokit({ auth: token });
      const { data: jobs } = await octokit.actions.listJobsForWorkflowRun({
        owner,
        repo,
        run_id: runId,
      });

      // Get the deploy job
      const deployJob = jobs.jobs.find(job => job.name === 'deploy');

      if (!deployJob) {
        return undefined;
      }

      // Get the logs for the job
      const logs = await this.fetchJobLogs(owner, repo, deployJob.id, token);

      // Extract deployment URL from logs
      const urlMatch = logs.match(/🔗 Deployment URL: (https:\/\/[^\s]+)/);
      return urlMatch ? urlMatch[1] : undefined;
    } catch (error) {
      this.logger.error(`Error extracting deployment URL: ${error.message}`);
      return undefined;
    }
  }

  /**
   * Fetch job logs
   */
  private async fetchJobLogs(
    owner: string,
    repo: string,
    jobId: number,
    token: string,
  ): Promise<string> {
    try {
      const octokit = new Octokit({ auth: token });
      const response = await octokit.request(
        `GET /repos/${owner}/${repo}/actions/jobs/${jobId}/logs`,
        {
          headers: {
            accept: 'application/octet-stream',
          },
        },
      );

      // Handle the response based on what type it is
      if (typeof response.data === 'string') {
        return response.data.toString();
      } else if (response.data instanceof ArrayBuffer || response.data instanceof Uint8Array) {
        return new TextDecoder().decode(response.data);
      } else if (response.data && typeof response.data === 'object') {
        return JSON.stringify(response.data);
      }

      return '';
    } catch (error) {
      this.logger.error(`Error fetching job logs: ${error.message}`);
      return '';
    }
  }

  /**
   * Batch deploy for multiple users
   */
  public async batchDeploy(configs: DeploymentConfig[]): Promise<DeploymentResult[]> {
    const results: DeploymentResult[] = [];

    for (const config of configs) {
      try {
        const result = await this.triggerDeployment(config);
        results.push(result);
      } catch (error) {
        this.logger.error(`Error in batch deployment for ${config.name}: ${error.message}`);
        results.push({
          success: false,
          userId: config.id,
          userName: config.name,
          environment: config.environment,
          error: error.message,
          timestamp: new Date(),
        });
      }
    }

    return results;
  }
}
