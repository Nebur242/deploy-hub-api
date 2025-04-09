import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  IsUUID,
  ValidateNested,
  Length,
} from 'class-validator';

import { TechStack, Visibility } from '../entities/project.entity';

class CategoryDto {
  @IsUUID()
  id: string;
}

export class CreateProjectDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Category slug for URL', maxLength: 100 })
  @IsNotEmpty()
  @IsString()
  @Length(1, 100)
  slug: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsString()
  repository: string;

  @IsArray()
  @IsEnum(TechStack, { each: true })
  techStack: TechStack[];

  @IsEnum(Visibility)
  @IsOptional()
  visibility?: Visibility;

  @IsNotEmpty({ each: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryDto)
  categories: CategoryDto[];
}
