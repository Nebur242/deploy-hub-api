import { DeploymentProvider } from '@app/modules/projects/entities/project-configuration.entity';
import { Injectable } from '@nestjs/common';

import { Deployment } from '../entities/deployment.entity';

@Injectable()
export class DeploymentUrlExtractorService {
  extractUrlFromLogs(logs: string, deployment: Deployment) {
    switch (deployment.configuration.deploymentOption.provider) {
      case DeploymentProvider.VERCEL: {
        return this.extractVercelUrl(logs);
      }
      case DeploymentProvider.NETLIFY: {
        return this.extractNetlifyUrl(logs);
      }
      default: {
        // For other providers, we can return null or handle them as needed
        return '';
      }
    }
  }

  extractVercelUrl(logString: string): string | null {
    // Method 1: Look for "Production: " pattern (most reliable)
    const productionPattern = /Production:\s+(https:\/\/[^\s]+)/;
    const productionMatch = logString.match(productionPattern);

    if (productionMatch && productionMatch[1]) {
      return productionMatch[1];
    }

    // Method 2: Look for standalone Vercel URLs at the end of deployment
    // This captures URLs that appear alone on a line after "Completing"
    const standaloneUrlPattern = /Completing[\s\S]*?\n(https:\/\/[a-zA-Z0-9-]+\.vercel\.app)\s*$/m;
    const standaloneMatch = logString.match(standaloneUrlPattern);

    if (standaloneMatch && standaloneMatch[1]) {
      return standaloneMatch[1];
    }

    // Method 3: Fallback - find any Vercel app URL (less reliable)
    const fallbackPattern = /https:\/\/[a-zA-Z0-9-]+\.vercel\.app/g;
    const allMatches = logString.match(fallbackPattern);

    if (allMatches && allMatches.length > 0) {
      // Return the last URL found (usually the final production URL)
      return allMatches[allMatches.length - 1];
    }

    return null;
  }

  extractNetlifyUrl(logString: string): string | null {
    // Method 1: Look for "Published on" pattern (most reliable for Netlify)
    const publishedPattern = /🎉 Published on (https:\/\/[^\s]+) as production/;
    const publishedMatch = logString.match(publishedPattern);

    if (publishedMatch && publishedMatch[1]) {
      return publishedMatch[1];
    }

    // Method 2: Look for "Deployed on" pattern (deployment-specific URL)
    const deployedPattern = /🚀 Deployed on (https:\/\/[^\s]+)/;
    const deployedMatch = logString.match(deployedPattern);

    if (deployedMatch && deployedMatch[1]) {
      return deployedMatch[1];
    }

    // Method 3: Fallback - find any netlify.app URL
    const netlifyPattern = /https:\/\/[a-zA-Z0-9-]+\.netlify\.app/g;
    const allMatches = logString.match(netlifyPattern);

    if (allMatches && allMatches.length > 0) {
      // Return the last URL found (usually the final production URL)
      return allMatches[allMatches.length - 1];
    }

    return null;
  }
}
