import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateVersionDto {
  @IsNotEmpty()
  @IsString()
  version: string;

  @IsOptional()
  @IsString()
  releaseNotes?: string;

  @IsOptional()
  @IsString()
  commitHash?: string;

  @IsOptional()
  @IsBoolean()
  isStable?: boolean;
}
