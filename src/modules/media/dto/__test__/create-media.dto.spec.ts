import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { MediaType } from '../../entities/media.entity';
import { CreateMediaDto } from '../create-media.dto';

describe('CreateMediaDto', () => {
  let validDto: CreateMediaDto;

  beforeEach(() => {
    validDto = {
      filename: 'my profile photo',
      originalFilename: 'profile-photo.jpg',
      mimeType: 'image/jpeg',
      type: MediaType.IMAGE,
      size: 1024,
      url: 'https://example.com/image.jpg',
      thumbnailUrl: 'https://example.com/thumbnail.jpg',
      width: 1920,
      height: 1080,
      duration: 120,
      alt: 'Profile photo',
      metadata: { author: 'John Doe' },
      isPublic: true,
      tags: ['profile', 'avatar'],
    };
  });

  it('should pass validation with valid DTO', async () => {
    const dtoObj = plainToInstance(CreateMediaDto, validDto);
    const errors = await validate(dtoObj);
    expect(errors.length).toBe(0);
  });

  it('should fail when required fields are missing', async () => {
    const invalidDto = {
      // Missing required fields
    };
    const dtoObj = plainToInstance(CreateMediaDto, invalidDto);
    const errors = await validate(dtoObj);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when filename is not a string', async () => {
    const invalidDto = { ...validDto, filename: 123 };
    const dtoObj = plainToInstance(CreateMediaDto, invalidDto);
    const errors = await validate(dtoObj);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when type is not a valid MediaType', async () => {
    const invalidDto = { ...validDto, type: 'INVALID_TYPE' };
    const dtoObj = plainToInstance(CreateMediaDto, invalidDto);
    const errors = await validate(dtoObj);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should fail when size is not a number', async () => {
    const invalidDto = { ...validDto, size: 'not-a-number' };
    const dtoObj = plainToInstance(CreateMediaDto, invalidDto);
    const errors = await validate(dtoObj);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should transform isPublic string "true" to boolean true', () => {
    const dto = { ...validDto, isPublic: 'true' };
    const dtoObj = plainToInstance(CreateMediaDto, dto);
    expect(dtoObj.isPublic).toBe(true);
  });

  it('should fail when tags is not an array of strings', async () => {
    const invalidDto = { ...validDto, tags: [123, 456] };
    const dtoObj = plainToInstance(CreateMediaDto, invalidDto);
    const errors = await validate(dtoObj);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should pass with optional fields omitted', async () => {
    const minimalDto = {
      filename: 'my profile photo',
      originalFilename: 'profile-photo.jpg',
      mimeType: 'image/jpeg',
      type: MediaType.IMAGE,
      size: 1024,
      url: 'https://example.com/image.jpg',
    };
    const dtoObj = plainToInstance(CreateMediaDto, minimalDto);
    const errors = await validate(dtoObj);
    expect(errors.length).toBe(0);
  });
});
