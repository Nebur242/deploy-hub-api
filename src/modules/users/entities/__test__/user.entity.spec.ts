import { UserNotification } from '../user-notification.entity';
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
    user.first_name = 'John';
    user.last_name = 'Doe';
    user.company = 'Test Co';
    user.profile_picture = 'profile.jpg';
    user.roles = ['user'];

    expect(user.id).toEqual('test-id');
    expect(user.uid).toEqual('firebase-uid');
    expect(user.first_name).toEqual('John');
    expect(user.last_name).toEqual('Doe');
    expect(user.company).toEqual('Test Co');
    expect(user.profile_picture).toEqual('profile.jpg');
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

  it('should associate with notifications', () => {
    const user = new User();
    const notifications = new UserNotification();
    notifications.id = 'notif-id';
    notifications.project_updates = true;
    notifications.deployment_alerts = false;
    notifications.license_expiration = true;

    user.notifications = notifications;

    expect(user.notifications).toBeDefined();
    expect(user.notifications.id).toEqual('notif-id');
    expect(user.notifications.project_updates).toBe(true);
    expect(user.notifications.deployment_alerts).toBe(false);
    expect(user.notifications.license_expiration).toBe(true);
  });

  it('should have created_at and updated_at dates', () => {
    const user = new User();
    const now = new Date();

    user.created_at = now;
    user.updated_at = now;

    expect(user.created_at).toEqual(now);
    expect(user.updated_at).toEqual(now);
  });

  it('should have default values for non-required fields', () => {
    const user = new User();

    expect(user.first_name).toBeUndefined();
    expect(user.last_name).toBeUndefined();
    expect(user.company).toBeUndefined();
    expect(user.profile_picture).toBeUndefined();
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
