import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';

type CreateNetlifySiteDto = {
  token: string;
};

type NetlifyResponse = {
  id: string;
  name: string;
  url: string;
  site_id: string;
};

@Injectable()
export class NetlifyService {
  private readonly logger = new Logger(NetlifyService.name);
  private readonly apiUrl = 'https://api.netlify.com/api/v1';

  /**
   * Create a new Netlify site
   * @param createSiteDto Site creation parameters
   * @returns Object with site data
   */
  async createSite(createSiteDto: CreateNetlifySiteDto): Promise<NetlifyResponse> {
    const { token } = createSiteDto;

    // Generate a unique site name
    const uniqueId = uuidv4().substring(0, 8);
    const siteName = `deploy-hub-${uniqueId}`;

    try {
      // Create a new Netlify site
      const response = await axios.post<NetlifyResponse>(
        `${this.apiUrl}/sites`,
        {
          name: siteName,
          // You can add more configuration here as needed
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`Created Netlify site: ${response.data.name} (${response.data.id})`);

      return {
        id: response.data.id,
        name: response.data.name,
        url: response.data.url,
        site_id: response.data.id,
      };
    } catch (err) {
      const error = err as AxiosError<Error>;
      const errorMessage = error.response?.data?.message || error.message;
      this.logger.error(`Failed to create Netlify site: ${errorMessage}`);
      throw new Error(`Failed to create Netlify site: ${errorMessage}`);
    }
  }

  async getSite(siteId: string, token: string): Promise<NetlifyResponse> {
    try {
      const response = await axios.get<NetlifyResponse>(`${this.apiUrl}/sites/${siteId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      this.logger.log(`Retrieved Netlify site: ${response.data.name} (${response.data.id})`);
      return {
        id: response.data.id,
        name: response.data.name,
        url: response.data.url,
        site_id: response.data.id,
      };
    } catch (err) {
      const error = err as AxiosError<Error>;
      const errorMessage = error.response?.data?.message || error.message;
      this.logger.error(`Failed to retrieve Netlify site: ${errorMessage}`);
      throw new Error(`Failed to retrieve Netlify site: ${errorMessage}`);
    }
  }
}
