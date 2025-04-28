# Users Module

## Overview

The Users Module manages user accounts, profiles, and roles within the Deploy Hub API. This module provides functionality for user registration, profile management, and role-based permissions, working closely with the Authentication Module.

## Features

- User account management
- User profile data
- Role management (Admin, User, SuperAdmin)
- User preferences
- User notifications
- Integration with Auth Module

## Entities

### User

The `User` entity represents a registered user in the system and contains:

- Basic information (name, email)
- Authentication details
- Role information
- Account status
- Profile preferences
- Notification settings
- Associated licenses and projects

## Services

### UserService

Provides methods for:

- Creating and updating user accounts
- Finding users by various criteria
- Managing user roles
- Validating user access
- Handling profile information

## Integration Points

The Users Module integrates with:

- **Auth Module**: For authentication and authorization
- **Licenses Module**: For tracking user license ownership
- **Projects Module**: For managing user project associations
- **Payment Module**: For tracking user purchases

## User Roles and Permissions

The module supports different user roles with varying permissions:

1. **User**: Standard user with access to own resources
2. **Admin**: Administrative user with elevated permissions
3. **SuperAdmin**: Highest level of access for system management

## Usage

### User Creation

```typescript
// Example: Creating a new user
const user = await userService.createUser({
  email: 'user@example.com',
  displayName: 'John Doe',
  firebaseUid: 'firebase-uid',
  role: Role.USER,
});
```

### Finding Users

```typescript
// Example: Finding a user by email
const user = await userService.findByEmail('user@example.com');

// Example: Finding a user by ID
const user = await userService.findById(userId);
```

### Updating User Information

```typescript
// Example: Updating a user's profile
await userService.updateUser(userId, {
  displayName: 'Jane Doe',
  avatarUrl: 'https://example.com/avatar.jpg',
});

// Example: Updating user notification settings
await userService.updateNotifications(userId, {
  projectUpdates: true,
  marketing: false,
});
```

### Managing Roles

```typescript
// Example: Promoting a user to admin (requires SuperAdmin)
await userService.updateUserRole(userId, Role.ADMIN);
```

## Error Handling

The module includes error handling for:

- User not found
- Duplicate user accounts
- Unauthorized role changes
- Invalid user data

# User API

This document provides an overview of the User API endpoints available in the `UserController`. All endpoints require authentication as enforced by the `@Authenticated` decorator.

## Endpoints

### Create User

**URL:** `/users`

**Method:** `POST`

**Description:** Creates a new user using the provided DTO and the current Firebase user.

**Request Body:**

- `createUserDto` - The data transfer object containing user information for creation.
  - `firstName` (optional, string): The first name of the user.
  - `lastName` (optional, string): The last name of the user.
  - `uid` (string): The unique identifier of the user.
  - `roles` (array of strings: user, admin, super_admin): The roles assigned to the user.
  - `company` (optional, string): The company of the user.

**Response:**

- `UserResponseDto` - The user response DTO containing the created user's information.
  - `id` (string): The unique identifier of the user.
  - `uid` (string): The unique identifier of the user.
  - `firstName` (optional, string): The first name of the user.
  - `lastName` (optional, string): The last name of the user.
  - `company` (optional, string): The company of the user.
  - `roles` (array of strings: user, admin, super_admin): The roles assigned to the user.
  - `createdAt` (Date): The date when the user was created.
  - `updatedAt` (Date): The date when the user was last updated.

**Errors:**

- `UnauthorizedException`: If the current user is not authenticated.
- `BadRequestException`: If the user data is invalid.

### Retrieve User

**URL:** `/users/:uid`

**Method:** `GET`

**Description:** Retrieves a user by their UID.

**Parameters:**

- `uid` (string): The unique identifier of the user to retrieve.

**Response:**

- `UserResponseDto` - The user response DTO containing the user's information.
  - `id` (string): The unique identifier of the user.
  - `uid` (string): The unique identifier of the user.
  - `firstName` (optional, string): The first name of the user.
  - `lastName` (optional, string): The last name of the user.
  - `company` (optional, string): The company of the user.
  - `roles` (array of strings: user, admin, super_admin): The roles assigned to the user.
  - `createdAt` (Date): The date when the user was created.
  - `updatedAt` (Date): The date when the user was last updated.

**Errors:**

- `ForbiddenException`: When the current user tries to access another user's data.

### Update User

**URL:** `/users/:id`

**Method:** `PATCH`

**Description:** Updates an existing user by ID with the provided data.

**Parameters:**

- `id` (string): The UUID of the user to update.

**Request Body:**

- `updateUserDto` - The data to update the user with.
  - `firstName` (optional, string): The first name of the user.
  - `lastName` (optional, string): The last name of the user.
  - `company` (optional, string): The company of the user.

**Response:**

- `UserResponseDto` - The updated user mapped to response DTO.
  - `id` (string): The unique identifier of the user.
  - `uid` (string): The unique identifier of the user.
  - `firstName` (optional, string): The first name of the user.
  - `lastName` (optional, string): The last name of the user.
  - `company` (optional, string): The company of the user.
  - `preferences` (optional, object): The user's preferences.
  - `notifications` (optional, object): The user's notification settings.
  - `roles` (array of strings: user, admin, super_admin): The roles assigned to the user.
  - `createdAt` (Date): The date when the user was created.
  - `updatedAt` (Date): The date when the user was last updated.

**Errors:**

- `NotFoundException`: If the user with the given ID is not found.

### Update User Preferences

**URL:** `/users/:id/preferences`

**Method:** `PATCH`

**Description:** Updates the preferences of a user identified by its UUID.

**Parameters:**

- `id` (string): The UUID of the user to update.

**Request Body:**

- `preferencesDto` - The DTO containing user preferences to be updated.
  - `theme` (optional, string): The theme preference of the user.
  - `emailNotifications` (optional, boolean): The email notifications preference of the user.
  - `preferredDeploymentProviders` (optional, array of strings: user, admin, super_admin): The preferred deployment providers of the user.

**Response:**

- `UserResponseDto` - The updated user data in the response DTO format.
  - `id` (string): The unique identifier of the user.
  - `uid` (string): The unique identifier of the user.
  - `firstName` (optional, string): The first name of the user.
  - `lastName` (optional, string): The last name of the user.
  - `company` (optional, string): The company of the user.
  - `preferences` (optional, object): The user's preferences.
  - `notifications` (optional, object): The user's notification settings.
  - `roles` (array of strings: user, admin, super_admin): The roles assigned to the user.
  - `createdAt` (Date): The date when the user was created.
  - `updatedAt` (Date): The date when the user was last updated.

**Errors:**

- `NotFoundException`: If the user with the specified ID is not found.
- `UnauthorizedException`: If the requester doesn't have permission to update the user's preferences.
- `BadRequestException`: If the preferences data is invalid.

### Update User Notifications

**URL:** `/users/:id/notifications`

**Method:** `PATCH`

**Description:** Updates the notification settings of a user identified by its UUID.

**Parameters:**

- `id` (string): The UUID of the user to update.

**Request Body:**

- `notificationDto` - The DTO containing user notification settings to be updated.
  - `projectUpdates` (optional, boolean): Whether to receive project update notifications.
  - `deploymentAlerts` (optional, boolean): Whether to receive deployment alert notifications.
  - `licenseExpiration` (optional, boolean): Whether to receive license expiration notifications.
  - `marketing` (optional, boolean): Whether to receive marketing notifications.

**Response:**

- `UserResponseDto` - The updated user data in the response DTO format.
  - `id` (string): The unique identifier of the user.
  - `uid` (string): The unique identifier of the user.
  - `firstName` (optional, string): The first name of the user.
  - `lastName` (optional, string): The last name of the user.
  - `company` (optional, string): The company of the user.
  - `preferences` (optional, object): The user's preferences.
  - `notifications` (optional, object): The user's notification settings.
  - `roles` (array of strings: user, admin, super_admin): The roles assigned to the user.
  - `createdAt` (Date): The date when the user was created.
  - `updatedAt` (Date): The date when the user was last updated.

**Errors:**

- `NotFoundException`: If the user with the specified ID is not found.
- `UnauthorizedException`: If the requester doesn't have permission to update the user's notifications.
- `BadRequestException`: If the notification data is invalid.
