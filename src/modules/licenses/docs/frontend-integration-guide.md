# Deploy Hub API - Frontend Integration Guide

## Overview

This guide provides comprehensive documentation for frontend developers integrating with the Deploy Hub API, specifically covering the UserLicense system and deployment functionality after the recent migration from DeploymentCount to UserLicense.

## Recent Changes (Migration from DeploymentCount to UserLicense)

**Important:** The deployment system has been updated to use UserLicense entities instead of the previous DeploymentCount system. This provides better integration with the payment and licensing workflow.

### What Changed

1. **Endpoint Changes:**

   - ❌ **Removed:** `GET /deployments/count`
   - ✅ **New:** `GET /deployments/licenses` (returns UserLicense data with deployment tracking)

2. **Data Structure Changes:**

   - UserLicense entities now handle both license management AND deployment counting
   - Deployment limits are enforced through UserLicense.maxDeployments
   - Deployment usage is tracked via UserLicense.count

3. **License Creation:**
   - UserLicenses are automatically created when payments are successful
   - No manual license creation needed for deployment tracking

## Base URLs

```
User Licenses: /api/v1/user-licenses
Deployments: /api/v1/deployments
```

## Authentication

All endpoints require Firebase JWT authentication:

```javascript
headers: {
  'Authorization': `Bearer ${firebaseToken}`,
  'Content-Type': 'application/json'
}
```

## Core API Endpoints

### 1. User License Management

#### Get Current User's Licenses (Paginated)

```http
GET /api/v1/user-licenses?page=1&limit=10
```

**Response:**

```json
{
  "items": [
    {
      "id": "license-uuid",
      "ownerId": "user-uuid",
      "licenseId": "license-option-uuid",
      "expiresAt": "2025-12-31T23:59:59.000Z",
      "active": true,
      "count": 5,
      "maxDeployments": 10,
      "deployments": ["deployment-1", "deployment-2"],
      "trial": false,
      "metadata": {
        "orderReference": "ORDER-001",
        "paymentId": "payment-uuid"
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

#### Get Active Licenses Only

```http
GET /api/v1/user-licenses/active-licenses
```

**Response:** Array of active UserLicense objects (same structure as above)

#### Get Specific License

```http
GET /api/v1/user-licenses/{licenseId}
```

### 2. Deployment with License Integration

#### Get User Licenses via Deployment Module (NEW)

```http
GET /api/v1/deployments/licenses?page=1&limit=10
```

This endpoint provides the same UserLicense data but accessed through the deployment module for deployment-specific contexts.

#### Create Deployment (with automatic license validation)

```http
POST /api/v1/deployments
```

**Request Body:**

```json
{
  "projectId": "project-uuid",
  "environment": "production",
  "version": "1.0.0",
  "configuration": {
    "buildCommand": "npm run build",
    "outputDirectory": "dist"
  }
}
```

The deployment service will automatically:

1. Validate user has active UserLicense
2. Check deployment limits (count < maxDeployments)
3. Increment license count on successful deployment
4. Add deployment ID to license.deployments array

## Frontend Implementation Examples

### React Hook for License Management

```javascript
import { useState, useEffect } from 'react';
import { useAuth } from './auth'; // Your Firebase auth hook

export const useUserLicenses = (page = 1, limit = 10) => {
  const [licenses, setLicenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState(null);
  const { user, getIdToken } = useAuth();

  const fetchLicenses = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const token = await getIdToken();
      const response = await fetch(`/api/v1/user-licenses?page=${page}&limit=${limit}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setLicenses(data.items);
      setPagination(data.meta);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Failed to fetch licenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLicenses();
  }, [user, page, limit]);

  return {
    licenses,
    loading,
    error,
    pagination,
    refetch: fetchLicenses,
  };
};

// Usage in component
const LicenseDashboard = () => {
  const { licenses, loading, error, pagination } = useUserLicenses();

  if (loading) return <div>Loading licenses...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Your Licenses</h2>
      {licenses.map(license => (
        <LicenseCard key={license.id} license={license} />
      ))}
      <Pagination {...pagination} />
    </div>
  );
};
```

### License Card Component

```javascript
const LicenseCard = ({ license }) => {
  const usagePercentage = (license.count / license.maxDeployments) * 100;
  const isNearLimit = usagePercentage >= 80;
  const isExpired = license.expiresAt && new Date(license.expiresAt) < new Date();

  return (
    <div className={`license-card ${!license.active || isExpired ? 'inactive' : ''}`}>
      <div className="license-header">
        <h3>{license.license?.name || 'License'}</h3>
        <span className={`status ${license.active && !isExpired ? 'active' : 'inactive'}`}>
          {license.active && !isExpired ? 'Active' : 'Inactive'}
        </span>
      </div>

      <div className="deployment-usage">
        <div className="usage-stats">
          <span>
            {license.count} / {license.maxDeployments} deployments used
          </span>
          <span className={`percentage ${isNearLimit ? 'warning' : ''}`}>
            {Math.round(usagePercentage)}%
          </span>
        </div>

        <div className="progress-bar">
          <div
            className={`progress-fill ${isNearLimit ? 'warning' : ''}`}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          />
        </div>
      </div>

      {license.expiresAt && (
        <div className="expiration">
          <span>Expires: {new Date(license.expiresAt).toLocaleDateString()}</span>
        </div>
      )}

      {license.trial && <div className="trial-badge">Trial License</div>}
    </div>
  );
};
```

### Deployment Hook with License Validation

```javascript
export const useDeployment = () => {
  const [deploying, setDeploying] = useState(false);
  const [deploymentError, setDeploymentError] = useState(null);
  const { user, getIdToken } = useAuth();

  const checkDeploymentEligibility = async () => {
    try {
      const token = await getIdToken();
      const response = await fetch('/api/v1/user-licenses/active-licenses', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const activeLicenses = await response.json();

      // Find license with available deployments
      const availableLicense = activeLicenses.find(license => {
        const notExpired = !license.expiresAt || new Date(license.expiresAt) > new Date();
        const hasDeployments = license.count < license.maxDeployments;
        return license.active && notExpired && hasDeployments;
      });

      if (!availableLicense) {
        return {
          canDeploy: false,
          reason: 'No active license with available deployments',
        };
      }

      return {
        canDeploy: true,
        license: availableLicense,
        remainingDeployments: availableLicense.maxDeployments - availableLicense.count,
      };
    } catch (error) {
      return {
        canDeploy: false,
        reason: 'Failed to check license status',
      };
    }
  };

  const createDeployment = async deploymentData => {
    setDeploying(true);
    setDeploymentError(null);

    try {
      // Check eligibility first
      const eligibility = await checkDeploymentEligibility();
      if (!eligibility.canDeploy) {
        throw new Error(eligibility.reason);
      }

      const token = await getIdToken();
      const response = await fetch('/api/v1/deployments', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deploymentData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Deployment failed');
      }

      const deployment = await response.json();
      return deployment;
    } catch (error) {
      setDeploymentError(error.message);
      throw error;
    } finally {
      setDeploying(false);
    }
  };

  return {
    deploying,
    deploymentError,
    createDeployment,
    checkDeploymentEligibility,
  };
};
```

### Vue.js Composable

```javascript
import { ref, computed } from 'vue';

export function useUserLicenses(page = 1, limit = 10) {
  const licenses = ref([]);
  const loading = ref(false);
  const error = ref(null);
  const pagination = ref(null);

  const activeLicenses = computed(() =>
    licenses.value.filter(license => {
      const notExpired = !license.expiresAt || new Date(license.expiresAt) > new Date();
      return license.active && notExpired;
    }),
  );

  const canDeploy = computed(() =>
    activeLicenses.value.some(license => license.count < license.maxDeployments),
  );

  const totalUsage = computed(() => {
    const active = activeLicenses.value;
    if (active.length === 0) return { used: 0, total: 0, percentage: 0 };

    const used = active.reduce((sum, license) => sum + license.count, 0);
    const total = active.reduce((sum, license) => sum + license.maxDeployments, 0);

    return {
      used,
      total,
      percentage: total > 0 ? Math.round((used / total) * 100) : 0,
    };
  });

  const fetchLicenses = async () => {
    loading.value = true;
    error.value = null;

    try {
      const token = await getFirebaseToken(); // Your auth method
      const response = await fetch(`/api/v1/user-licenses?page=${page}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      licenses.value = data.items;
      pagination.value = data.meta;
    } catch (err) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  };

  return {
    licenses,
    loading,
    error,
    pagination,
    activeLicenses,
    canDeploy,
    totalUsage,
    fetchLicenses,
  };
}
```

## Migration Guide for Existing Frontend Code

### If you were using the old `/deployments/count` endpoint:

#### Before (Old):

```javascript
// ❌ This endpoint no longer exists
const response = await fetch('/api/v1/deployments/count');
const deploymentCounts = await response.json();
```

#### After (New):

```javascript
// ✅ Use UserLicense endpoints instead
const response = await fetch('/api/v1/user-licenses/active-licenses');
const activeLicenses = await response.json();

// Or via deployment module
const response = await fetch('/api/v1/deployments/licenses');
const licenseData = await response.json();
```

### Data Structure Changes:

#### Before (DeploymentCount):

```javascript
{
  id: "count-uuid",
  licenseId: "license-uuid",
  ownerId: "user-uuid",
  count: 5,
  maxDeployments: 10,
  deployments: ["deploy-1", "deploy-2"]
}
```

#### After (UserLicense):

```javascript
{
  id: "license-uuid",
  ownerId: "user-uuid",
  licenseId: "license-option-uuid",
  active: true,
  expiresAt: "2025-12-31T23:59:59.000Z",
  count: 5,                    // Same as before
  maxDeployments: 10,         // Same as before
  deployments: ["deploy-1", "deploy-2"], // Same as before
  trial: false,
  metadata: { /* payment info */ }
}
```

## Common UI Patterns

### License Usage Dashboard

```javascript
const LicenseUsageDashboard = () => {
  const { licenses, loading } = useUserLicenses();

  const totalStats = useMemo(() => {
    const active = licenses.filter(
      l => l.active && (!l.expiresAt || new Date(l.expiresAt) > new Date()),
    );
    return {
      totalLicenses: active.length,
      totalDeployments: active.reduce((sum, l) => sum + l.count, 0),
      totalLimit: active.reduce((sum, l) => sum + l.maxDeployments, 0),
      availableDeployments: active.reduce((sum, l) => sum + (l.maxDeployments - l.count), 0),
    };
  }, [licenses]);

  return (
    <div className="usage-dashboard">
      <div className="stats-grid">
        <StatCard title="Active Licenses" value={totalStats.totalLicenses} />
        <StatCard title="Deployments Used" value={totalStats.totalDeployments} />
        <StatCard title="Total Limit" value={totalStats.totalLimit} />
        <StatCard title="Available" value={totalStats.availableDeployments} />
      </div>

      <div className="license-list">
        {licenses.map(license => (
          <LicenseCard key={license.id} license={license} />
        ))}
      </div>
    </div>
  );
};
```

### Deployment Button with License Check

```javascript
const DeployButton = ({ projectId, onDeploy }) => {
  const { canDeploy, checkDeploymentEligibility } = useDeployment();
  const [eligibility, setEligibility] = useState(null);

  useEffect(() => {
    checkDeploymentEligibility().then(setEligibility);
  }, []);

  const handleDeploy = async () => {
    if (eligibility?.canDeploy) {
      onDeploy();
    }
  };

  if (!eligibility) return <button disabled>Checking...</button>;

  return (
    <div>
      <button
        onClick={handleDeploy}
        disabled={!eligibility.canDeploy}
        className={eligibility.canDeploy ? 'btn-primary' : 'btn-disabled'}
      >
        {eligibility.canDeploy ? 'Deploy Project' : 'Cannot Deploy'}
      </button>

      {!eligibility.canDeploy && <p className="error-message">{eligibility.reason}</p>}

      {eligibility.canDeploy && (
        <p className="info-message">{eligibility.remainingDeployments} deployments remaining</p>
      )}
    </div>
  );
};
```

## Error Handling

### Common Error Scenarios

1. **No Active License**

```javascript
{
  "statusCode": 403,
  "message": "No active license found for deployment",
  "error": "Forbidden"
}
```

2. **Deployment Limit Exceeded**

```javascript
{
  "statusCode": 403,
  "message": "Deployment limit exceeded for license",
  "error": "Forbidden"
}
```

3. **License Expired**

```javascript
{
  "statusCode": 403,
  "message": "License has expired",
  "error": "Forbidden"
}
```

### Error Handling Pattern

```javascript
const handleApiError = (error, response) => {
  switch (response.status) {
    case 401:
      // Redirect to login
      redirectToLogin();
      break;
    case 403:
      if (error.message.includes('license')) {
        // Show license upgrade modal
        showLicenseUpgradeModal();
      }
      break;
    case 404:
      // Resource not found
      showNotFoundMessage();
      break;
    default:
      // Generic error
      showErrorMessage(error.message);
  }
};
```

## Testing

### Mock Data for Development

```javascript
// Mock UserLicense data
export const mockUserLicense = {
  id: 'license-123',
  ownerId: 'user-456',
  licenseId: 'license-option-789',
  active: true,
  expiresAt: '2025-12-31T23:59:59.000Z',
  count: 3,
  maxDeployments: 10,
  deployments: ['deploy-1', 'deploy-2', 'deploy-3'],
  trial: false,
  metadata: {
    orderReference: 'ORDER-001',
    paymentId: 'payment-123',
  },
  createdAt: '2025-01-15T10:30:00.000Z',
  updatedAt: '2025-06-20T14:22:00.000Z',
};

// Mock API responses
export const mockApiResponses = {
  getUserLicenses: {
    items: [mockUserLicense],
    meta: {
      totalItems: 1,
      itemCount: 1,
      itemsPerPage: 10,
      totalPages: 1,
      currentPage: 1,
    },
  },
};
```

## Next Steps

1. **Update Frontend Code**: Replace any usage of `/deployments/count` with UserLicense endpoints
2. **Test Integration**: Verify deployment limits work correctly with new UserLicense system
3. **Update UI**: Show license information and deployment usage in your dashboards
4. **Monitor**: Track API calls to ensure migration is complete

## Support

For questions about this integration or issues with the API:

1. Check the full API documentation in `/src/modules/licenses/docs/user-license-api.md`
2. Review the deployment module docs in `/src/modules/deployments/docs/README.md`
3. Test endpoints using the provided Postman collections
4. Contact the backend team for additional support

---

**Last Updated:** Post-migration to UserLicense system  
**API Version:** v1  
**Documentation Version:** 2.0
