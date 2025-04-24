# Authentication Module

## Overview

The Authentication Module handles user authentication and authorization within the Deploy Hub API. This module integrates Firebase Authentication for secure user management and provides role-based access control for various API endpoints.

## Features

- Firebase Authentication integration
- Role-based access control
- User authentication guards
- Admin authorization controls
- Authentication decorators

## Components

### FirebaseAuthStrategy

A custom Passport strategy for Firebase Authentication that:

- Validates Firebase ID tokens
- Extracts user information from Firebase
- Associates Firebase users with application users
- Sets up user role information

### Auth Guards

- **RolesAuthGuard**: Restricts access to endpoints based on user roles (Admin, User, SuperAdmin)

### Decorators

- **CurrentUser**: Extracts the authenticated user from the request
- **FirebaseUser**: Extracts Firebase user data from the request

## Integration

The Auth Module integrates with:

1. **Firebase Module** - For Firebase API interaction
2. **Users Module** - For user management and role assignment

## Usage

### Protecting Routes with Authentication

```typescript
@Controller('protected-route')
@UseGuards(AuthGuard) // Requires authentication
export class ProtectedController {
  @Get()
  getProtectedResource(@CurrentUser() user: User) {
    return { message: `Hello, ${user.email}` };
  }
}
```

### Restricting Routes to Admins

```typescript
@Controller('admin-route')
export class AdminController {
  @Get()
  @Admin() // Restricts access to admin users only
  getAdminResource(@CurrentUser() user: User) {
    return { message: `Hello, admin ${user.email}` };
  }
}
```

### Authentication Flow

1. Client obtains Firebase authentication token
2. Client includes token in Authorization header
3. Server validates token using Firebase Admin SDK
4. Server associates Firebase user with internal user
5. Server grants access based on user roles and permissions

## Security Considerations

- Token validation and verification
- Secure role-based permissions
- Protection against common authentication attacks
- Integration with Firebase security features

## Error Handling

The module handles various authentication scenarios:

- Invalid or expired tokens
- Unauthorized access attempts
- Missing authentication
- Role-based permission denials
