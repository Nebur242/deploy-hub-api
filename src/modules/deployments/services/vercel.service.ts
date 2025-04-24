import { Injectable } from '@nestjs/common';
import { Vercel } from '@vercel/sdk';
import { v4 as uuidv4 } from 'uuid';

type CreateProjectDto = {
  orgId: string;
  token: string;
};

@Injectable()
export class VercelService {
  /**
   * Create a new Vercel project
   * @param createProjectDto Project creation parameters
   * @returns Observable with project data
   */
  createProject(createProjectDto: CreateProjectDto) {
    const { orgId, token: bearerToken } = createProjectDto;
    const vercel = new Vercel({
      bearerToken,
    });

    const name = uuidv4();
    const slug = name.replace(/-/g, '');

    return vercel.projects.createProject({
      teamId: orgId,
      slug,
      requestBody: {
        name,
        framework: 'nextjs',
      },
    });
  }
}
