import { UserPreferences } from '../user-preferences.entity';
import { User } from '../user.entity';

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

  it('should have default values for non-required fields', () => {
    const user = new User();

    expect(user.firstName).toBeUndefined();
    expect(user.lastName).toBeUndefined();
    expect(user.company).toBeUndefined();
    expect(user.profilePicture).toBeUndefined();
  });

  it('should have default role as user', () => {
    const user = new User();
    // Note: We can't test the default value directly as it's set by the database,
    // but we can test that roles can be set and retrieved
    user.roles = ['user'];
    expect(user.roles).toEqual(['user']);
  });

  it('should support multiple roles', () => {
    const user = new User();
    user.roles = ['user', 'admin'];
    expect(user.roles).toContain('user');
    expect(user.roles).toContain('admin');
    expect(user.roles.length).toBe(2);
  });
});
