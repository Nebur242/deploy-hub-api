GitHub Copilot: # Category API Documentation

## Overview

This API provides endpoints for managing categories, including:

- Creating categories
- Retrieving categories (single, paginated, or hierarchical tree)
- Updating categories
- Deleting categories

All endpoints require admin authentication.

---

## Endpoints

### 1. Create a New Category

**POST** `/categories`

#### Description

Creates a new category.

#### Request Body

```json
{
  "name": "string",
  "slug": "string",
  "parentId": "string (optional)",
  "isActive": "boolean"
}
```

#### Headers

- `Authorization`: Bearer token for authentication.

#### Responses

- **201 Created**: Returns the created category.
- **400 Bad Request**: If the category data is invalid.
- **409 Conflict**: If the category already exists.

---

### 2. Get All Categories

**GET** `/categories`

#### Description

Retrieves a list of all categories with optional filters.

#### Query Parameters

- `parentId` (string, optional): Filter by parent ID or "root".
- `isActive` (boolean, optional): Filter by active status.
- `search` (string, optional): Search by name.
- `includeInactive` (boolean, optional): Include inactive categories.

#### Responses

- **200 OK**: Returns a list of categories.

---

### 3. Get Paginated Categories

**GET** `/categories/paginated`

#### Description

Retrieves a paginated list of categories with optional filters.

#### Query Parameters

- `page` (number, optional): Page number (default: 1).
- `limit` (number, optional): Items per page (default: 10).
- `parentId` (string, optional): Filter by parent ID or "root".
- `isActive` (boolean, optional): Filter by active status.
- `search` (string, optional): Search by name.
- `includeInactive` (boolean, optional): Include inactive categories.

#### Response Format

```json
{
  "items": [
    {
      // CategoryResponseDto object
    }
  ],
  "meta": {
    "totalItems": 100,
    "itemCount": 10,
    "itemsPerPage": 10,
    "totalPages": 10,
    "currentPage": 1
  },
  "links": {
    "first": "/categories/paginated?limit=10",
    "previous": "",
    "next": "/categories/paginated?page=2&limit=10",
    "last": "/categories/paginated?page=10&limit=10"
  }
}
```

#### Responses

- **200 OK**: Returns a paginated list of categories.

---

### 4. Get Category Hierarchy Tree

**GET** `/categories/tree`

#### Description

Retrieves the category hierarchy tree.

#### Query Parameters

- `parentId` (string, optional): Root node for the tree.
- `includeInactive` (boolean, optional): Include inactive categories.

#### Responses

- **200 OK**: Returns the category hierarchy tree.

---

### 5. Get Category by ID

**GET** `/categories/:id`

#### Description

Retrieves a category by its ID.

#### Path Parameters

- `id` (string): The ID of the category.

#### Responses

- **200 OK**: Returns the category.
- **404 Not Found**: If the category is not found.

---

### 6. Get Category by Slug

**GET** `/categories/slug/:slug`

#### Description

Retrieves a category by its slug.

#### Path Parameters

- `slug` (string): The slug of the category.

#### Responses

- **200 OK**: Returns the category.
- **404 Not Found**: If the category is not found.

---

### 7. Update a Category

**PATCH** `/categories/:id`

#### Description

Updates an existing category.

#### Path Parameters

- `id` (string): The ID of the category.

#### Request Body

```json
{
  "name": "string",
  "slug": "string",
  "parentId": "string (optional)",
  "isActive": "boolean"
}
```

#### Headers

- `Authorization`: Bearer token for authentication.

#### Responses

- **200 OK**: Returns the updated category.
- **404 Not Found**: If the category is not found.
- **403 Forbidden**: If the user is not authorized.
- **409 Conflict**: If there is a conflict with existing data.

---

### 8. Delete a Category

**DELETE** `/categories/:id`

#### Description

Deletes a category by its ID.

#### Path Parameters

- `id` (string): The ID of the category.

#### Headers

- `Authorization`: Bearer token for authentication.

#### Responses

- **204 No Content**: If the category is successfully deleted.
- **404 Not Found**: If the category is not found.
- **403 Forbidden**: If the user is not authorized.
- **409 Conflict**: If the category has child categories and cannot be deleted.

---

## Data Models

### CategoryResponseDto

```typescript
{
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### CategoryTreeDto

```typescript
{
  id: string;
  name: string;
  slug: string;
  parentId?: string;
  isActive: boolean;
  children?: CategoryTreeDto[];
}
```

---

## Notes

- All endpoints require admin authentication.
- The paginated response includes metadata and navigation links.
- Categories can be organized in a hierarchical structure with parent-child relationships.
