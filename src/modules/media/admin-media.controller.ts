import { Admin } from '@app/core/guards/roles-auth.guard';
import {
  Controller,
  Get,
  Patch,
  Param,
  Delete,
  HttpStatus,
  HttpCode,
  ParseUUIDPipe,
  Query,
  Body,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';

import { MediaQueryDto } from './dto/media-query.dto';
import { MediaResponseDto } from './dto/media-response.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { MediaService } from './media.service';

@ApiTags('admin/media')
@Controller('admin/media')
@Admin()
@ApiBearerAuth()
export class AdminMediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  @ApiOperation({ summary: 'Admin - Get all media records' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Return all media records.',
    type: [MediaResponseDto],
  })
  findAll(@Query() paginationOptionsDto: MediaQueryDto) {
    return this.mediaService.findAll(paginationOptionsDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Admin - Get a media record by id' })
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
  @ApiOperation({ summary: 'Admin - Update a media record' })
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
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Admin - Delete a media record and the associated file' })
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
