export class GitHubAccount {
  username: string;
  access_token: string;
  repository: string;
  workflow_file: string;
  available: boolean;
  failureCount: number;
  lastUsed?: Date;
}
