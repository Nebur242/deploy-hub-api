import { ModerationStatus } from '@app/shared/enums';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * DTO for submitting a project for review
 */
export class SubmitForReviewDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string; // Optional message from owner to admin
}

/**
 * DTO for admin moderation action
 */
export class ModerationActionDto {
  @IsNotEmpty()
  @IsEnum(ModerationStatus, {
    message: 'Status must be one of: approved, rejected',
  })
  status: ModerationStatus.APPROVED | ModerationStatus.REJECTED;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string; // Admin note explaining the decision
}

/**
 * DTO for searching projects in moderation queue
 */
export class ModerationSearchDto {
  @IsOptional()
  @IsEnum(ModerationStatus)
  status?: ModerationStatus;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
