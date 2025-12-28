# UserLicense API Documentation

## Overview

The UserLicense API provides endpoints for managing user licenses within the Deploy Hub system. UserLicenses are created automatically when a user successfully purchases a license and represent the actual license ownership with deployment tracking capabilities.

## Base URL

```
/api/v1/user-licenses
```

## Authentication

All endpoints require authentication. Include the Firebase JWT token in the Authorization header:

```
Authorization: Bearer <firebase-jwt-token>
```

## Data Models

### UserLicense Object

```typescript
interface UserLicense {
  id: string; // UUID - Unique identifier
  ownerId: string; // UUID - User ID who owns the license
  owner?: User; // User object (populated in responses)
  licenseId: string; // UUID - Reference to the license option
  license?: LicenseOption; // License option object (populated in some responses)
  expiresAt?: Date; // Date when license expires (null for lifetime licenses)
  active: boolean; // Whether the license is currently active
  count: number; // Current number of deployments used
  maxDeployments: number; // Maximum deployments allowed
  deployments: string[]; // Array of deployment IDs
  trial: boolean; // Whether this is a trial license
  metadata?: Record<string, any>; // Additional metadata (order info, payment details)
  createdAt: Date; // When the license was created
  updatedAt: Date; // When the license was last updated
}
```

### Pagination Response

```typescript
interface PaginationResponse<T> {
  items: T[]; // Array of items for current page
  meta: {
    totalItems: number; // Total number of items
    itemCount: number; // Number of items in current page
    itemsPerPage: number; // Items per page
    totalPages: number; // Total number of pages
    currentPage: number; // Current page number
  };
  links: {
    first: string; // URL to first page
    previous?: string; // URL to previous page
    next?: string; // URL to next page
    last: string; // URL to last page
  };
}
```

## Endpoints

### 1. Get User Licenses (Paginated)

Get all licenses for the current authenticated user with pagination.

**Endpoint:** `GET /user-licenses`

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response:** `200 OK`

```json
{
  "items": [
    {
      "id": "license-uuid",
      "ownerId": "user-uuid",
      "owner": {
        "id": "user-uuid",
        "email": "user@example.com",
        "displayName": "John Doe"
      },
      "licenseId": "license-option-uuid",
      "expiresAt": "2025-12-31T23:59:59.000Z",
      "active": true,
      "count": 5,
      "maxDeployments": 10,
      "deployments": ["deployment-uuid-1", "deployment-uuid-2"],
      "trial": false,
      "metadata": {
        "orderReference": "ORDER-001",
        "paymentId": "payment-uuid",
        "paymentDate": "2025-01-15T10:30:00.000Z",
        "adminAssigned": false
      },
      "createdAt": "2025-01-15T10:30:00.000Z",
      "updatedAt": "2025-06-20T14:22:00.000Z"
    }
  ],
  "meta": {
    "totalItems": 1,
    "itemCount": 1,
    "itemsPerPage": 10,
    "totalPages": 1,
    "currentPage": 1
  }
}
```

**Example Usage:**

```javascript
// Get first page with default limit (10)
fetch('/api/v1/user-licenses', {
  headers: { Authorization: `Bearer ${token}` },
});

// Get page 2 with 5 items per page
fetch('/api/v1/user-licenses?page=2&limit=5', {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 2. Get Specific User License

Get a specific user license by its ID.

**Endpoint:** `GET /user-licenses/:id`

**Path Parameters:**

- `id` (required): UserLicense UUID

**Response:** `200 OK`

```json
{
  "id": "license-uuid",
  "ownerId": "user-uuid",
  "owner": {
    "id": "user-uuid",
    "email": "user@example.com",
    "displayName": "John Doe"
  },
  "licenseId": "license-option-uuid",
  "expiresAt": "2025-12-31T23:59:59.000Z",
  "active": true,
  "count": 5,
  "maxDeployments": 10,
  "deployments": ["deployment-uuid-1", "deployment-uuid-2"],
  "trial": false,
  "metadata": {
    "orderReference": "ORDER-001",
    "paymentId": "payment-uuid",
    "paymentDate": "2025-01-15T10:30:00.000Z"
  },
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-06-20T14:22:00.000Z"
}
```

**Error Responses:**

- `404 Not Found`: User license not found

**Example Usage:**

```javascript
fetch('/api/v1/user-licenses/license-uuid', {
  headers: { Authorization: `Bearer ${token}` },
});
```

### 3. Get Active User Licenses

Get all active licenses for the current authenticated user.

**Endpoint:** `GET /user-licenses/active-licenses`

**Response:** `200 OK`

```json
[
  {
    "id": "license-uuid",
    "ownerId": "user-uuid",
    "owner": {
      "id": "user-uuid",
      "email": "user@example.com",
      "displayName": "John Doe"
    },
    "licenseId": "license-option-uuid",
    "license": {
      "id": "license-option-uuid",
      "name": "Pro License",
      "deploymentLimit": 10
    },
    "expiresAt": "2025-12-31T23:59:59.000Z",
    "active": true,
    "count": 5,
    "maxDeployments": 10,
    "deployments": ["deployment-uuid-1", "deployment-uuid-2"],
    "trial": false,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-06-20T14:22:00.000Z"
  }
]
```

**Example Usage:**

```javascript
fetch('/api/v1/user-licenses/active-licenses', {
  headers: { Authorization: `Bearer ${token}` },
});
```

## Admin Endpoints

The following endpoints are only available to admin users.

### 4. Get All User Licenses (Admin Only)

Get all user licenses across all users with filtering and pagination.

**Endpoint:** `GET /user-licenses/admin/all`

**Required Role:** Admin

**Query Parameters:**

- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)
- `ownerId` (optional): Filter by user ID
- `active` (optional): Filter by active status (true/false)
- `licenseId` (optional): Filter by license option ID

**Response:** `200 OK` - Same format as paginated user licenses

**Example Usage:**

```javascript
// Get all user licenses
fetch('/api/v1/user-licenses/admin/all', {
  headers: { Authorization: `Bearer ${adminToken}` },
});

// Get active licenses for a specific user
fetch('/api/v1/user-licenses/admin/all?ownerId=user-uuid&active=true', {
  headers: { Authorization: `Bearer ${adminToken}` },
});

// Get all licenses for a specific license option
fetch('/api/v1/user-licenses/admin/all?licenseId=license-option-uuid', {
  headers: { Authorization: `Bearer ${adminToken}` },
});
```

### 5. Get Active Licenses for Any User (Admin Only)

Get all active licenses for a specific user.

**Endpoint:** `GET /user-licenses/admin/active`

**Required Role:** Admin

**Query Parameters:**

- `userId` (required): User ID to get active licenses for

**Response:** `200 OK`

```json
[
  {
    "id": "license-uuid",
    "ownerId": "user-uuid",
    "owner": {
      "id": "user-uuid",
      "email": "user@example.com",
      "displayName": "John Doe"
    },
    "licenseId": "license-option-uuid",
    "active": true,
    "count": 5,
    "maxDeployments": 10,
    "createdAt": "2025-01-15T10:30:00.000Z",
    "updatedAt": "2025-06-20T14:22:00.000Z"
  }
]
```

**Error Responses:**

- `404 Not Found`: User ID is required

**Example Usage:**

```javascript
fetch('/api/v1/user-licenses/admin/active?userId=user-uuid', {
  headers: { Authorization: `Bearer ${adminToken}` },
});
```

## License Status and Deployment Tracking

### License Status

- **active: true** - License is currently usable for deployments
- **active: false** - License is inactive (expired, revoked, or suspended)

### Deployment Tracking

- **count** - Current number of deployments used
- **maxDeployments** - Maximum deployments allowed by this license
- **deployments** - Array of deployment IDs that have been created using this license

### Expiration

- **expiresAt: null** - Lifetime license (never expires)
- **expiresAt: Date** - License expires on this date

## Error Handling

All endpoints follow standard HTTP status codes:

- `200 OK` - Success
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Missing or invalid authentication
- `403 Forbidden` - Insufficient permissions (admin required)
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

Error Response Format:

```json
{
  "statusCode": 404,
  "message": "User license with ID license-uuid not found",
  "error": "Not Found"
}
```

## Integration Notes

### For Frontend Developers

1. **Authentication**: Always include the Firebase JWT token in requests
2. **Pagination**: Use the pagination metadata to build UI pagination controls
3. **License Status**: Check both `active` and `expiresAt` to determine if a license is usable
4. **Deployment Limits**: Use `count` and `maxDeployments` to show usage progress
5. **Admin Features**: Only show admin endpoints if the current user has admin role

### Sample React Hook

```javascript
import { useState, useEffect } from 'react';

export const useUserLicenses = (page = 1, limit = 10) => {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState(null);

  useEffect(() => {
    const fetchLicenses = async () => {
      try {
        const token = await getFirebaseToken(); // Your auth method
        const response = await fetch(`/api/v1/user-licenses?page=${page}&limit=${limit}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        setLicenses(data.items);
        setPagination(data.meta);
      } catch (error) {
        console.error('Failed to fetch licenses:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLicenses();
  }, [page, limit]);

  return { licenses, loading, pagination };
};
```

### Sample Vue.js Composable

```javascript
import { ref, onMounted } from 'vue';

export function useUserLicenses(page = 1, limit = 10) {
  const licenses = ref([]);
  const loading = ref(true);
  const pagination = ref(null);

  const fetchLicenses = async () => {
    try {
      const token = await getFirebaseToken(); // Your auth method
      const response = await fetch(`/api/v1/user-licenses?page=${page}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      licenses.value = data.items;
      pagination.value = data.meta;
    } catch (error) {
      console.error('Failed to fetch licenses:', error);
    } finally {
      loading.value = false;
    }
  };

  onMounted(fetchLicenses);

  return { licenses, loading, pagination, fetchLicenses };
}
```

## Common Use Cases

### 1. Display User's License Dashboard

```javascript
// Get active licenses for dashboard
const activeLicenses = await fetch('/api/v1/user-licenses/active-licenses', {
  headers: { Authorization: `Bearer ${token}` },
}).then(res => res.json());

// Show license usage
activeLicenses.forEach(license => {
  const usagePercentage = (license.count / license.maxDeployments) * 100;
  console.log(`${license.license.name}: ${usagePercentage}% used`);
});
```

### 2. Check if User Can Deploy

```javascript
const canDeploy = license => {
  const isActive = license.active;
  const notExpired = !license.expiresAt || new Date(license.expiresAt) > new Date();
  const hasDeployments = license.count < license.maxDeployments;

  return isActive && notExpired && hasDeployments;
};
```

### 3. Admin License Management

```javascript
// Get all licenses for admin dashboard
const allLicenses = await fetch('/api/v1/user-licenses/admin/all?page=1&limit=50', {
  headers: { Authorization: `Bearer ${adminToken}` },
}).then(res => res.json());

// Filter by license type
const proLicenses = await fetch('/api/v1/user-licenses/admin/all?licenseId=pro-license-uuid', {
  headers: { Authorization: `Bearer ${adminToken}` },
}).then(res => res.json());
```

### 4. Redeploy Existing Deployment

```javascript
// Redeploy with same configuration
const redeployment = await fetch(`/api/v1/deployments/${deploymentId}/redeploy`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({}), // Empty body uses original configuration
});

// Redeploy with environment override
const redeployment = await fetch(`/api/v1/deployments/${deploymentId}/redeploy`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    environment: 'production',
    branch: 'release-v2.0',
  }),
});
```
