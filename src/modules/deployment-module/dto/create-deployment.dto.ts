import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

// create-deployment.dto.ts

export class CreateDeploymentDto {
  // User identification
  @ApiProperty({ description: 'Unique identifier for the user' })
  @IsString()
  @IsNotEmpty()
  id: string;

  @ApiProperty({ description: 'User name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  // Vercel credentials
  @ApiProperty({ description: 'Vercel API token' })
  @IsString()
  @IsNotEmpty()
  vercelToken: string;

  @ApiProperty({ description: 'Vercel project ID' })
  @IsString()
  @IsNotEmpty()
  vercelProjectId: string;

  @ApiProperty({ description: 'Vercel organization ID' })
  @IsString()
  @IsNotEmpty()
  vercelOrgId: string;

  // Supabase credentials
  @ApiProperty({ description: 'Supabase URL' })
  @IsString()
  @IsNotEmpty()
  supabaseUrl: string;

  @ApiProperty({ description: 'Supabase anonymous key' })
  @IsString()
  @IsNotEmpty()
  supabaseAnonKey: string;

  // Deployment options
  @ApiPropertyOptional({ enum: ['production', 'preview'], description: 'Deployment environment' })
  @IsEnum(['production', 'preview'])
  @IsOptional()
  environment?: 'production' | 'preview';

  @ApiPropertyOptional({ description: 'Git branch to deploy' })
  @IsString()
  @IsOptional()
  branch?: string;
}

// batch-deployment.dto.ts
export class BatchDeploymentDto {
  @ApiProperty({
    type: [CreateDeploymentDto],
    description: 'Array of deployments to process in batch',
  })
  @IsNotEmpty()
  deployments: CreateDeploymentDto[];
}
