# Redeployment Feature Integration Guide

## Overview

The redeployment feature allows users to create a new deployment based on an existing deployment's configuration. This is useful for:

- Redeploying the same application to a different environment
- Redeploying with updated environment variables
- Redeploying from a different branch
- Quick rollbacks to previous configurations

## API Endpoint

```
POST /api/v1/deployments/:deploymentId/redeploy
```

## Request Body (RedeployDeploymentDto)

All fields are optional. If not provided, the original deployment's values will be used.

```typescript
interface RedeployDeploymentDto {
  environment?: 'production' | 'preview'; // Override environment
  branch?: string; // Override branch
  environmentVariables?: EnvironmentVariable[]; // Override environment variables
}

interface EnvironmentVariable {
  key: string;
  defaultValue: string;
  description: string;
  isRequired: boolean;
  isSecret: boolean;
  type: 'text' | 'number' | 'boolean';
}
```

## Response

Returns a new `Deployment` object with the same structure as creating a new deployment.

## Frontend Implementation Examples

### React Hook for Redeployment

```javascript
import { useState } from 'react';
import { useAuth } from './useAuth'; // Your auth hook

export const useRedeployment = () => {
  const [redeploying, setRedeploying] = useState(false);
  const [redeploymentError, setRedeploymentError] = useState(null);
  const { getIdToken } = useAuth();

  const redeployDeployment = async (deploymentId, overrides = {}) => {
    setRedeploying(true);
    setRedeploymentError(null);

    try {
      const token = await getIdToken();
      const response = await fetch(`/api/v1/deployments/${deploymentId}/redeploy`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(overrides),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Redeployment failed');
      }

      const newDeployment = await response.json();
      return newDeployment;
    } catch (error) {
      setRedeploymentError(error.message);
      throw error;
    } finally {
      setRedeploying(false);
    }
  };

  return {
    redeploying,
    redeploymentError,
    redeployDeployment,
  };
};
```

### Vue.js Composable for Redeployment

```javascript
import { ref } from 'vue';
import { useAuth } from './useAuth'; // Your auth composable

export function useRedeployment() {
  const redeploying = ref(false);
  const redeploymentError = ref(null);
  const { getIdToken } = useAuth();

  const redeployDeployment = async (deploymentId, overrides = {}) => {
    redeploying.value = true;
    redeploymentError.value = null;

    try {
      const token = await getIdToken();
      const response = await fetch(`/api/v1/deployments/${deploymentId}/redeploy`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(overrides),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Redeployment failed');
      }

      const newDeployment = await response.json();
      return newDeployment;
    } catch (error) {
      redeploymentError.value = error.message;
      throw error;
    } finally {
      redeploying.value = false;
    }
  };

  return {
    redeploying,
    redeploymentError,
    redeployDeployment,
  };
}
```

## UI Component Examples

### React Redeployment Button

```jsx
import React, { useState } from 'react';
import { useRedeployment } from './hooks/useRedeployment';

const RedeploymentButton = ({ deployment, onSuccess }) => {
  const [showOptions, setShowOptions] = useState(false);
  const [overrides, setOverrides] = useState({});
  const { redeploying, redeploymentError, redeployDeployment } = useRedeployment();

  const handleRedeploy = async () => {
    try {
      const newDeployment = await redeployDeployment(deployment.id, overrides);
      onSuccess?.(newDeployment);
      setShowOptions(false);
      setOverrides({});
    } catch (error) {
      // Error is handled by the hook
      console.error('Redeployment failed:', error);
    }
  };

  const handleQuickRedeploy = async () => {
    try {
      const newDeployment = await redeployDeployment(deployment.id);
      onSuccess?.(newDeployment);
    } catch (error) {
      console.error('Quick redeployment failed:', error);
    }
  };

  return (
    <div className="redeployment-controls">
      {/* Quick redeploy button */}
      <button onClick={handleQuickRedeploy} disabled={redeploying} className="btn btn-primary">
        {redeploying ? 'Redeploying...' : 'Redeploy'}
      </button>

      {/* Advanced options button */}
      <button onClick={() => setShowOptions(!showOptions)} className="btn btn-secondary">
        Options
      </button>

      {/* Advanced options modal/dropdown */}
      {showOptions && (
        <div className="redeployment-options">
          <div className="form-group">
            <label>Environment:</label>
            <select
              value={overrides.environment || deployment.environment}
              onChange={e =>
                setOverrides({
                  ...overrides,
                  environment: e.target.value,
                })
              }
            >
              <option value="preview">Preview</option>
              <option value="production">Production</option>
            </select>
          </div>

          <div className="form-group">
            <label>Branch:</label>
            <input
              type="text"
              value={overrides.branch || deployment.branch}
              onChange={e =>
                setOverrides({
                  ...overrides,
                  branch: e.target.value,
                })
              }
              placeholder="Branch name"
            />
          </div>

          <div className="form-actions">
            <button onClick={handleRedeploy} disabled={redeploying} className="btn btn-primary">
              {redeploying ? 'Redeploying...' : 'Redeploy with Options'}
            </button>
            <button onClick={() => setShowOptions(false)} className="btn btn-secondary">
              Cancel
            </button>
          </div>

          {redeploymentError && <div className="error-message">{redeploymentError}</div>}
        </div>
      )}
    </div>
  );
};

export default RedeploymentButton;
```

### Vue.js Redeployment Component

```vue
<template>
  <div class="redeployment-controls">
    <!-- Quick redeploy button -->
    <button @click="handleQuickRedeploy" :disabled="redeploying" class="btn btn-primary">
      {{ redeploying ? 'Redeploying...' : 'Redeploy' }}
    </button>

    <!-- Advanced options button -->
    <button @click="showOptions = !showOptions" class="btn btn-secondary">Options</button>

    <!-- Advanced options modal -->
    <div v-if="showOptions" class="redeployment-options">
      <div class="form-group">
        <label>Environment:</label>
        <select v-model="overrides.environment">
          <option value="preview">Preview</option>
          <option value="production">Production</option>
        </select>
      </div>

      <div class="form-group">
        <label>Branch:</label>
        <input v-model="overrides.branch" type="text" :placeholder="deployment.branch" />
      </div>

      <div class="form-actions">
        <button @click="handleRedeploy" :disabled="redeploying" class="btn btn-primary">
          {{ redeploying ? 'Redeploying...' : 'Redeploy with Options' }}
        </button>
        <button @click="showOptions = false" class="btn btn-secondary">Cancel</button>
      </div>

      <div v-if="redeploymentError" class="error-message">
        {{ redeploymentError }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue';
import { useRedeployment } from './composables/useRedeployment';

const props = defineProps({
  deployment: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['success']);

const showOptions = ref(false);
const overrides = reactive({
  environment: props.deployment.environment,
  branch: props.deployment.branch,
});

const { redeploying, redeploymentError, redeployDeployment } = useRedeployment();

const handleQuickRedeploy = async () => {
  try {
    const newDeployment = await redeployDeployment(props.deployment.id);
    emit('success', newDeployment);
  } catch (error) {
    console.error('Quick redeployment failed:', error);
  }
};

const handleRedeploy = async () => {
  try {
    const newDeployment = await redeployDeployment(props.deployment.id, overrides);
    emit('success', newDeployment);
    showOptions.value = false;
  } catch (error) {
    console.error('Redeployment failed:', error);
  }
};
</script>
```

## Use Cases

### 1. Quick Redeploy (Same Configuration)

```javascript
// Redeploy with exact same configuration
const newDeployment = await redeployDeployment(deploymentId);
```

### 2. Environment Promotion

```javascript
// Promote from preview to production
const newDeployment = await redeployDeployment(deploymentId, {
  environment: 'production',
});
```

### 3. Branch Switch

```javascript
// Deploy from a different branch
const newDeployment = await redeployDeployment(deploymentId, {
  branch: 'hotfix-urgent-bug',
});
```

### 4. Configuration Update

```javascript
// Update environment variables
const newDeployment = await redeployDeployment(deploymentId, {
  environmentVariables: [
    {
      key: 'API_ENDPOINT',
      defaultValue: 'https://api-v2.example.com',
      description: 'Updated API endpoint',
      isRequired: true,
      isSecret: false,
      type: 'text',
    },
  ],
});
```

## Error Handling

### Common Error Scenarios

1. **License Limit Exceeded**

   ```json
   {
     "statusCode": 400,
     "message": "Deployment limit reached. Used 10/10 deployments.",
     "error": "Bad Request"
   }
   ```

2. **Original Deployment Not Found**

   ```json
   {
     "statusCode": 404,
     "message": "Deployment with ID \"deployment-uuid\" not found",
     "error": "Not Found"
   }
   ```

3. **Permission Denied**

   ```json
   {
     "statusCode": 403,
     "message": "You can only redeploy your own deployments",
     "error": "Forbidden"
   }
   ```

4. **Inactive License**
   ```json
   {
     "statusCode": 400,
     "message": "User license is no longer active",
     "error": "Bad Request"
   }
   ```

### Error Handling Best Practices

```javascript
const handleRedeployment = async (deploymentId, overrides) => {
  try {
    const newDeployment = await redeployDeployment(deploymentId, overrides);

    // Success feedback
    showNotification('Redeployment started successfully!', 'success');

    // Redirect to new deployment
    router.push(`/deployments/${newDeployment.id}`);
  } catch (error) {
    // Handle specific error cases
    if (error.message.includes('Deployment limit reached')) {
      showUpgradeModal();
    } else if (error.message.includes('not found')) {
      showNotification('Original deployment no longer exists', 'error');
    } else if (error.message.includes('no longer active')) {
      showNotification('Your license has expired. Please renew.', 'warning');
      router.push('/billing');
    } else {
      showNotification(`Redeployment failed: ${error.message}`, 'error');
    }
  }
};
```

## Integration Checklist

- [ ] Implement redeployment API calls
- [ ] Add redeployment buttons to deployment list/detail views
- [ ] Handle license validation and limit checks
- [ ] Provide clear feedback on redeployment status
- [ ] Implement error handling for common scenarios
- [ ] Add optional override forms for advanced users
- [ ] Test redeployment with different configurations
- [ ] Update deployment tracking and analytics

## Security Considerations

1. **Ownership Validation**: The API automatically verifies that users can only redeploy their own deployments
2. **License Verification**: Active license with available deployment slots is required
3. **Environment Variables**: Sensitive environment variables are properly encrypted/decrypted
4. **Authentication**: All redeployment requests require valid Firebase authentication

## Performance Considerations

1. **License Caching**: Consider caching license information to reduce database queries
2. **Async Processing**: Redeployments are processed asynchronously like regular deployments
3. **Rate Limiting**: Implement client-side rate limiting to prevent spam redeployments
4. **Loading States**: Provide clear loading indicators during redeployment process
