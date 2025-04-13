# Media Module

The Media Module provides a complete API for managing media files within the Deploy Hub API application. It handles creating, retrieving, updating, and deleting media records associated with file uploads.

## Features

- Create media records for uploaded files
- Retrieve media records with pagination support
- Get specific media records by ID
- Update media information
- Delete media records and their associated files
- Role-based access controls (Admin only)

## API Endpoints

| Method | Endpoint     | Description                        | Access     |
| ------ | ------------ | ---------------------------------- | ---------- |
| POST   | `/media`     | Create a new media record          | Admin only |
| GET    | `/media`     | Get all media with pagination      | Admin only |
| GET    | `/media/:id` | Get a specific media record by ID  | Admin only |
| PATCH  | `/media/:id` | Update an existing media record    | Admin only |
| DELETE | `/media/:id` | Delete a media record and its file | Admin only |

## DTOs

The module uses the following Data Transfer Objects:

- `CreateMediaDto`: For creating new media records
- `MediaResponseDto`: For structuring media response data
- `PaginationOptionsDto`: For handling pagination parameters
- `UpdateMediaDto`: For updating existing media records

## Security

All endpoints in the Media Module require admin privileges, enforced by the `@Admin()` decorator.
Authentication is handled using JWT Bearer tokens.

## Usage Example

```typescript
// Creating a new media record
POST /media
Authorization: Bearer <jwt-token>
Content-Type: application/json

{
  "url": "https://example.com/image.jpg",
  "type": "image",
  "name": "Example Image"
}
```

## Implementation Details

The Media Module is implemented using NestJS controllers and services. The controller handles HTTP requests and delegates business logic to the MediaService. The module uses UUID for record identification and implements proper validation using ParseUUIDPipe.

## Related Components

- `MediaService`: Handles the business logic for media operations
- `User Entity`: Media records are associated with user accounts via ownerId
