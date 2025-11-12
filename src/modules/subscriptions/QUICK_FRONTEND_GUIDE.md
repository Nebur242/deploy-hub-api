# Quick Frontend Integration Guide

This is a simplified guide for quickly integrating the subscription system into your frontend application.

## Installation

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

## Environment Setup

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
```

## Basic Integration Steps

### 1. Initialize Stripe

```javascript
// lib/stripe.js
import { loadStripe } from '@stripe/stripe-js';

export const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
```

### 2. API Helper

```javascript
// lib/api.js
const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export const api = {
  async get(endpoint) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
      },
    });
    return response.json();
  },

  async post(endpoint, data) {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    return response.json();
  },
};
```

### 3. Fetch User Subscription

```javascript
// hooks/useSubscription.js
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export function useSubscription() {
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/user-subscriptions/current')
      .then(data => setSubscription(data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return { subscription, loading };
}
```

### 4. Fetch Available Plans

```javascript
// hooks/usePlans.js
import { useState, useEffect } from 'react';
import { api } from '../lib/api';

export function usePlans() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get('/subscription-plans?isActive=true')
      .then(data => setPlans(data.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return { plans, loading };
}
```

### 5. Simple Plan Selection

```jsx
// components/PlanSelector.jsx
import React from 'react';
import { usePlans } from '../hooks/usePlans';
import { api } from '../lib/api';

export function PlanSelector() {
  const { plans, loading } = usePlans();

  const handleSelectPlan = async plan => {
    try {
      if (plan.type === 'free') {
        // Create free subscription
        await api.post('/user-subscriptions', { planId: plan.id });
        alert('Free plan activated!');
      } else {
        // Redirect to payment flow
        window.location.href = `/checkout?planId=${plan.id}`;
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  if (loading) return <div>Loading plans...</div>;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '20px',
      }}
    >
      {plans.map(plan => (
        <div
          key={plan.id}
          style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}
        >
          <h3>{plan.name}</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold' }}>
            {plan.price === 0 ? 'Free' : `$${plan.price / 100}/${plan.billingInterval}`}
          </p>
          <ul>
            {plan.features.map((feature, idx) => (
              <li key={idx}>✓ {feature}</li>
            ))}
          </ul>
          <button
            onClick={() => handleSelectPlan(plan)}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#0066cc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {plan.type === 'free' ? 'Start Free' : 'Choose Plan'}
          </button>
        </div>
      ))}
    </div>
  );
}
```

### 6. Payment Form (for paid plans)

```jsx
// components/CheckoutForm.jsx
import React, { useState } from 'react';
import { CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { api } from '../lib/api';

export function CheckoutForm({ planId }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async event => {
    event.preventDefault();
    setLoading(true);

    if (!stripe || !elements) return;

    const cardElement = elements.getElement(CardElement);

    // Create payment method
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    if (error) {
      alert('Payment error: ' + error.message);
      setLoading(false);
      return;
    }

    try {
      // Create subscription
      await api.post('/user-subscriptions', {
        planId,
        paymentMethodId: paymentMethod.id,
      });

      alert('Subscription created successfully!');
      window.location.href = '/dashboard';
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ maxWidth: '400px', margin: '0 auto' }}>
      <div style={{ padding: '20px', border: '1px solid #ccc', marginBottom: '20px' }}>
        <CardElement />
      </div>
      <button
        type="submit"
        disabled={!stripe || loading}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: '#0066cc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        {loading ? 'Processing...' : 'Subscribe'}
      </button>
    </form>
  );
}
```

### 7. Subscription Dashboard

```jsx
// components/SubscriptionDashboard.jsx
import React from 'react';
import { useSubscription } from '../hooks/useSubscription';
import { api } from '../lib/api';

export function SubscriptionDashboard() {
  const { subscription, loading } = useSubscription();

  const handleUpgrade = () => {
    window.location.href = '/upgrade';
  };

  const handleBillingPortal = async () => {
    try {
      const response = await api.post('/stripe/billing-portal', {
        returnUrl: window.location.href,
      });
      window.location.href = response.url;
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!subscription) return <div>No subscription found</div>;

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h2>Your Subscription</h2>

      <div
        style={{
          border: '1px solid #ccc',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
        }}
      >
        <h3>{subscription.plan.name}</h3>
        <p>
          Status: <strong>{subscription.status}</strong>
        </p>
        <p>Next billing: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</p>
        <p>
          Price:{' '}
          {subscription.plan.price === 0
            ? 'Free'
            : `$${subscription.plan.price / 100}/${subscription.plan.billingInterval}`}
        </p>

        <h4>Features:</h4>
        <ul>
          {subscription.plan.features.map((feature, idx) => (
            <li key={idx}>✓ {feature}</li>
          ))}
        </ul>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={handleUpgrade}
          style={{
            padding: '10px 20px',
            backgroundColor: '#0066cc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          Upgrade Plan
        </button>
        <button
          onClick={handleBillingPortal}
          style={{
            padding: '10px 20px',
            backgroundColor: '#666',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
          }}
        >
          Manage Billing
        </button>
      </div>
    </div>
  );
}
```

### 8. Main App Setup

```jsx
// App.jsx
import React from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { stripePromise } from './lib/stripe';
import { PlanSelector } from './components/PlanSelector';
import { CheckoutForm } from './components/CheckoutForm';
import { SubscriptionDashboard } from './components/SubscriptionDashboard';

function App() {
  const currentPath = window.location.pathname;
  const planId = new URLSearchParams(window.location.search).get('planId');

  return (
    <Elements stripe={stripePromise}>
      <div style={{ padding: '20px' }}>
        {currentPath === '/plans' && <PlanSelector />}
        {currentPath === '/checkout' && <CheckoutForm planId={planId} />}
        {currentPath === '/subscription' && <SubscriptionDashboard />}
      </div>
    </Elements>
  );
}

export default App;
```

## Quick API Endpoints Reference

```javascript
// Get current user subscription
GET /api/v1/user-subscriptions/current

// Get available plans
GET /api/v1/subscription-plans?isActive=true

// Create subscription
POST /api/v1/user-subscriptions
{
  "planId": "plan-id",
  "paymentMethodId": "pm_xxx" // Optional for free plans
}

// Get upgrade options
GET /api/v1/user-subscriptions/upgrade-options

// Upgrade plan
POST /api/v1/user-subscriptions/upgrade
{
  "planId": "new-plan-id",
  "prorationBehavior": "create_prorations"
}

// Create billing portal session
POST /api/v1/stripe/billing-portal
{
  "returnUrl": "https://yourapp.com/subscription"
}
```

## Subscription Status Checks

```javascript
// Check if user can create projects
function canCreateProject(subscription) {
  if (!subscription) return false;

  const limits = subscription.plan.limits || {};
  const projectLimit = limits.projects || 0;

  return subscription.currentUsage?.projects < projectLimit;
}

// Check if feature is available
function hasFeature(subscription, feature) {
  if (!subscription) return false;
  return subscription.plan.features.includes(feature);
}
```

This quick guide covers the essential integration steps. For more detailed implementation examples, see the complete `FRONTEND_INTEGRATION.md` guide.
