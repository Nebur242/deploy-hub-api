import { UserPreferences } from '../entities/user-preferences.entity';
import { User } from '../entities/user.entity';

describe('User Entity', () => {
  it('should create a user instance', () => {
    const user = new User();
    expect(user).toBeDefined();
  });

  it('should set and get properties correctly', () => {
    const user = new User();
    user.id = 'test-id';
    user.uid = 'firebase-uid';
    user.firstName = 'John';
    user.lastName = 'Doe';
    user.company = 'Test Co';
    user.profilePicture = 'profile.jpg';
    user.roles = ['user'];

    expect(user.id).toEqual('test-id');
    expect(user.uid).toEqual('firebase-uid');
    expect(user.firstName).toEqual('John');
    expect(user.lastName).toEqual('Doe');
    expect(user.company).toEqual('Test Co');
    expect(user.profilePicture).toEqual('profile.jpg');
    expect(user.roles).toEqual(['user']);
  });

  it('should associate with preferences', () => {
    const user = new User();
    const preferences = new UserPreferences();
    preferences.id = 'pref-id';

    user.preferences = preferences;

    expect(user.preferences).toBeDefined();
    expect(user.preferences.id).toEqual('pref-id');
  });

  it('should have createdAt and updatedAt dates', () => {
    const user = new User();
    const now = new Date();

    user.createdAt = now;
    user.updatedAt = now;

    expect(user.createdAt).toEqual(now);
    expect(user.updatedAt).toEqual(now);
  });
});
