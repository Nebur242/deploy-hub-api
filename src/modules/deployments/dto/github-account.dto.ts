export class GitHubAccount {
  username: string;
  accessToken: string;
  repository: string;
  workflowFile: string;
  available: boolean;
  failureCount: number;
  lastUsed?: Date;
}
