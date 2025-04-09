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
  - `roles` (array of strings: user, admin, super_admin): The roles assigned to the user.
  - `createdAt` (Date): The date when the user was created.
  - `updatedAt` (Date): The date when the user was last updated.

**Errors:**

- `NotFoundException`: If the user with the specified ID is not found.
- `UnauthorizedException`: If the requester doesn't have permission to update the user's preferences.
- `BadRequestException`: If the preferences data is invalid.
