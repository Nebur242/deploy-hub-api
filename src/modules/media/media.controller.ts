import { CurrentUser } from '@app/core/decorators/current-user.decorator';
import { Admin } from '@app/core/guards/roles-auth.guard';
import { User } from '@app/modules/users/entities/user.entity';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

import { CreateMediaDto } from './dto/create-media.dto';
import { MediaQueryDto } from './dto/media-query.dto';
import { MediaResponseDto } from './dto/media-response.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { MediaService } from './media.service';

@ApiTags('media')
@Controller('media')
@Admin()
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new media record (for frontend uploads)' })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'The media record has been successfully created.',
    type: MediaResponseDto,
  })
  create(@Body() createMediaDto: CreateMediaDto, @CurrentUser() user: User) {
    return this.mediaService.create({
      ...createMediaDto,
      ownerId: user.id,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all media' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Return all media records based on query.',
    type: [MediaResponseDto],
  })
  findAll(@Query() paginationOptionsDto: MediaQueryDto, @CurrentUser() user: User) {
    return this.mediaService.findAll({
      ...paginationOptionsDto,
      ownerId: user.id,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a media record by id' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Return the media record.',
    type: MediaResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Media record not found.' })
  @ApiParam({ name: 'id', description: 'Media ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.mediaService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a media record' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'The media record has been successfully updated.',
    type: MediaResponseDto,
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Media record not found.' })
  @ApiParam({ name: 'id', description: 'Media ID' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateMediaDto: UpdateMediaDto) {
    return this.mediaService.update(id, updateMediaDto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a media record and the associated file' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'The media record and file have been successfully deleted.',
  })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Media record not found.' })
  @ApiParam({ name: 'id', description: 'Media ID' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.mediaService.remove(id);
  }
}
