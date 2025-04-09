import { User } from '@app/modules/users/entities/user.entity';

import { Media, MediaType } from './media.entity';

describe('Media Entity', () => {
  let media: Media;
  let user: User;

  beforeEach(() => {
    user = new User();
    user.id = 'test-user-id';

    media = new Media();
    media.id = 'test-media-id';
    media.filename = 'test-file.jpg';
    media.originalFilename = 'original-test-file.jpg';
    media.mimeType = 'image/jpeg';
    media.type = MediaType.IMAGE;
    media.size = 1024;
    media.url = 'https://example.com/test-file.jpg';
    media.owner = user;
    media.ownerId = user.id;
  });

  it('should create a media entity instance', () => {
    expect(media).toBeDefined();
    expect(media.id).toBe('test-media-id');
  });

  it('should have correct default values', () => {
    const newMedia = new Media();
    newMedia.type = MediaType.OTHER;
    newMedia.isPublic = true;
    newMedia.duration = 0;
    newMedia.tags = [];
    expect(newMedia.type).toBe(MediaType.OTHER);
    expect(newMedia.isPublic).toBe(true);
    expect(newMedia.duration).toBe(0);
    expect(newMedia.tags).toEqual([]);
  });

  it('should set and get all properties correctly', () => {
    expect(media.filename).toBe('test-file.jpg');
    expect(media.originalFilename).toBe('original-test-file.jpg');
    expect(media.mimeType).toBe('image/jpeg');
    expect(media.type).toBe(MediaType.IMAGE);
    expect(media.size).toBe(1024);
    expect(media.url).toBe('https://example.com/test-file.jpg');
    expect(media.ownerId).toBe('test-user-id');
    expect(media.owner).toBe(user);

    // Set optional properties
    media.thumbnailUrl = 'https://example.com/thumbnail.jpg';
    media.width = 800;
    media.height = 600;
    media.alt = 'Test image';
    media.metadata = { key: 'value' };
    media.tags = ['test', 'image'];

    expect(media.thumbnailUrl).toBe('https://example.com/thumbnail.jpg');
    expect(media.width).toBe(800);
    expect(media.height).toBe(600);
    expect(media.alt).toBe('Test image');
    expect(media.metadata).toEqual({ key: 'value' });
    expect(media.tags).toEqual(['test', 'image']);
  });

  it('should correctly set createdAt and updatedAt dates', () => {
    const now = new Date();
    media.createdAt = now;
    media.updatedAt = now;

    expect(media.createdAt).toBe(now);
    expect(media.updatedAt).toBe(now);
  });

  it('should handle different media types', () => {
    expect(MediaType.IMAGE).toBe('image');
    expect(MediaType.VIDEO).toBe('video');
    expect(MediaType.DOCUMENT).toBe('document');
    expect(MediaType.AUDIO).toBe('audio');
    expect(MediaType.OTHER).toBe('other');

    media.type = MediaType.VIDEO;
    expect(media.type).toBe(MediaType.VIDEO);
  });
});
