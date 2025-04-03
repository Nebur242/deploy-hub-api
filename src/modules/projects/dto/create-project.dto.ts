import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsArray,
  IsOptional,
  IsUUID,
  ValidateNested,
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

  @IsString()
  description: string;

  @IsOptional()
  @IsString()
  repository: string;

  @IsArray()
  @IsEnum(TechStack, { each: true })
  techStack: TechStack[];

  @IsEnum(Visibility)
  @IsOptional()
  visibility: Visibility = Visibility.PRIVATE;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryDto)
  categories: CategoryDto[];
}
