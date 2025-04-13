/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { CreateMediaDto } from '../create-media.dto';
import { UpdateMediaDto } from '../update-media.dto';

describe('UpdateMediaDto', () => {
  let createMediaDto: CreateMediaDto;
  let updateMediaDto: UpdateMediaDto;

  beforeEach(() => {
    // Create a mock CreateMediaDto with all required properties
    createMediaDto = new CreateMediaDto();
    Object.assign(createMediaDto, {
      url: 'http://example.com/image.jpg',
      originalFilename: 'image.jpg',
      mimeType: 'image/jpeg',
      size: 1024,
      alt: 'Test image',
      description: 'A test image',
    });

    // Create an UpdateMediaDto instance
    updateMediaDto = new UpdateMediaDto();
  });

  it('should be defined', () => {
    expect(updateMediaDto).toBeDefined();
  });

  it('should inherit properties from CreateMediaDto except omitted ones', () => {
    // Can update properties that aren't omitted
    (updateMediaDto as any).alt = 'Updated alt';
    (updateMediaDto as any).description = 'Updated description';

    expect(updateMediaDto.alt).toBe('Updated alt');
    expect((updateMediaDto as any).description).toBe('Updated description');
  });

  it('should not have omitted properties', () => {
    // Check that omitted properties are not available
    expect('url' in updateMediaDto).toBe(false);
    expect('originalFilename' in updateMediaDto).toBe(false);
    expect('mimeType' in updateMediaDto).toBe(false);
    expect('size' in updateMediaDto).toBe(false);
  });

  it('should allow partial updates', () => {
    // Only update one property
    const partialUpdate = new UpdateMediaDto();
    (partialUpdate as any).alt = 'New alt';

    // Other properties should be undefined
    expect(partialUpdate.alt).toBe('New alt');
    expect((partialUpdate as any).description).toBeUndefined();
  });
});
