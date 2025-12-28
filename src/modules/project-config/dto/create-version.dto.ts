import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CreateVersionDto {
  @IsNotEmpty()
  @IsString()
  @Matches(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
    {
      message: 'Version must follow semantic versioning (e.g., 1.0.0)',
    },
  )
  version: string;

  @IsOptional()
  @IsString()
  release_notes?: string;

  @IsOptional()
  @IsString()
  commit_hash?: string;

  @IsOptional()
  @IsBoolean()
  is_stable?: boolean;
}
