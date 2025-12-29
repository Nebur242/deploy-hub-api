import { Injectable, Logger } from '@nestjs/common';
import { Vercel } from '@vercel/sdk';
import { v4 as uuidv4 } from 'uuid';

type CreateProjectDto = {
  orgId: string;
  token: string;
};

@Injectable()
export class VercelService {
  private readonly logger = new Logger(VercelService.name);

  /**
   * Create a new Vercel project
   * @param createProjectDto Project creation parameters
   * @returns Project data with id and name
   */
  async createProject(createProjectDto: CreateProjectDto) {
    const { orgId, token: bearerToken } = createProjectDto;

    this.logger.log(`[VERCEL] createProject called`);
    this.logger.log(`[VERCEL] orgId: ${orgId}`);
    this.logger.log(`[VERCEL] token length: ${bearerToken?.length || 0} chars`);

    if (!bearerToken) {
      this.logger.error(`[VERCEL] Token is missing`);
      throw new Error(
        'Invalid Vercel token. Please provide a valid Vercel API token from https://vercel.com/account/tokens',
      );
    }

    if (!orgId) {
      this.logger.error(`[VERCEL] Organization ID is missing`);
      throw new Error('Vercel Organization ID is required');
    }

    this.logger.log(`[VERCEL] Creating Vercel SDK client...`);
    const vercel = new Vercel({
      bearerToken,
    });

    const name = uuidv4();
    this.logger.log(`[VERCEL] Generated project name: ${name}`);

    try {
      this.logger.log(`[VERCEL] Calling vercel.projects.createProject...`);
      const project = await vercel.projects.createProject({
        teamId: orgId,
        slug: name,
        requestBody: {
          name,
          framework: 'nextjs',
        },
      });

      this.logger.log(
        `[VERCEL] Project created successfully: id=${project.id}, name=${project.name}`,
      );
      return project;
    } catch (error) {
      const err = error as { statusCode?: number; message?: string; body?: unknown };
      this.logger.error(`[VERCEL] API error: statusCode=${err.statusCode}, message=${err.message}`);

      if (err.statusCode === 401 || err.statusCode === 403) {
        throw new Error(
          'Invalid Vercel credentials. Please check your VERCEL_TOKEN and VERCEL_ORG_ID.',
        );
      }

      if (err.statusCode === 404) {
        throw new Error('Vercel team/organization not found. Please check your VERCEL_ORG_ID.');
      }

      this.logger.error(`[VERCEL] Full error details: ${JSON.stringify(err)}`);
      throw new Error(err.message || 'Failed to create Vercel project');
    }
  }
}
