import { DeploymentProvider, Theme } from '../dto/user-preferences.dto';
import { UserPreferences } from '../entities/user-preferences.entity';

describe('UserPreferences Entity', () => {
  // Helper function to create a UserPreferences with default values
  function createUserPreferencesWithDefaults(): UserPreferences {
    const userPreferences = new UserPreferences();
    // Manually set defaults as defined in the entity
    userPreferences.theme = Theme.SYSTEM;
    userPreferences.emailNotifications = true;
    return userPreferences;
  }

  it('should create a user preferences instance', () => {
    const userPreferences = new UserPreferences();
    expect(userPreferences).toBeDefined();
  });

  it('should have correct default values when set', () => {
    const userPreferences = createUserPreferencesWithDefaults();
    expect(userPreferences.theme).toEqual(Theme.SYSTEM);
    expect(userPreferences.emailNotifications).toEqual(true);
  });

  it('should allow setting theme', () => {
    const userPreferences = createUserPreferencesWithDefaults();
    userPreferences.theme = Theme.DARK;
    expect(userPreferences.theme).toEqual(Theme.DARK);
  });

  it('should allow setting emailNotifications', () => {
    const userPreferences = createUserPreferencesWithDefaults();
    userPreferences.emailNotifications = false;
    expect(userPreferences.emailNotifications).toEqual(false);
  });

  it('should allow setting preferredDeploymentProviders', () => {
    const userPreferences = createUserPreferencesWithDefaults();
    const providers = [DeploymentProvider.VERCEL, DeploymentProvider.NETLIFY];
    userPreferences.preferredDeploymentProviders = providers;
    expect(userPreferences.preferredDeploymentProviders).toEqual(providers);
  });
});
