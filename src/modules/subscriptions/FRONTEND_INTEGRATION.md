# Frontend Subscription Workflow Integration Guide

This comprehensive guide provides step-by-step instructions for implementing the complete subscription workflow on the frontend, including plan selection, payment processing, subscription management, and user experience flows.

## Table of Contents

1. [Overview](#overview)
2. [Initial Setup](#initial-setup)
3. [User Authentication Flow](#user-authentication-flow)
4. [Plan Selection & Display](#plan-selection--display)
5. [Payment Method Setup](#payment-method-setup)
6. [Subscription Creation](#subscription-creation)
7. [Subscription Management](#subscription-management)
8. [Upgrade/Downgrade Flow](#upgradedowngrade-flow)
9. [Billing Portal Integration](#billing-portal-integration)
10. [Error Handling](#error-handling)
11. [Code Examples](#code-examples)

## Overview

The subscription workflow involves several key components:

- **Plan Display**: Show available subscription plans with features
- **Payment Setup**: Collect payment method using Stripe Elements
- **Subscription Creation**: Create subscription with selected plan
- **Subscription Management**: View, upgrade, cancel subscriptions
- **Billing Portal**: Self-service billing management

## Initial Setup

### 1. Install Dependencies

```bash
# For React/Next.js
npm install @stripe/stripe-js @stripe/react-stripe-js

# For Vue.js
npm install @stripe/stripe-js vue-stripe-elements-plus

# For Angular
npm install @stripe/stripe-js @angular/common
```

### 2. Environment Configuration

```typescript
// config/stripe.ts
export const stripeConfig = {
  publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_...',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1',
};
```

### 3. Initialize Stripe

```typescript
// lib/stripe.ts
import { loadStripe } from '@stripe/stripe-js';
import { stripeConfig } from '../config/stripe';

export const stripePromise = loadStripe(stripeConfig.publishableKey);
```

## User Authentication Flow

### 1. Check User Subscription Status

```typescript
// hooks/useSubscription.ts
import { useState, useEffect } from 'react';

interface UserSubscription {
  id: string;
  planId: string;
  status: 'active' | 'trialing' | 'canceled' | 'past_due';
  currentPeriodEnd: string;
  plan: {
    id: string;
    name: string;
    type: 'free' | 'basic' | 'premium' | 'enterprise';
    price: number;
    features: string[];
  };
}

export const useSubscription = () => {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUserSubscription();
  }, []);

  const fetchUserSubscription = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/user-subscriptions/current', {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSubscription(data.data);
      } else if (response.status === 404) {
        // User has no subscription (should have free tier)
        setSubscription(null);
      } else {
        throw new Error('Failed to fetch subscription');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return { subscription, loading, error, refetch: fetchUserSubscription };
};
```

## Plan Selection & Display

### 1. Fetch Available Plans

```typescript
// hooks/usePlans.ts
import { useState, useEffect } from 'react';

interface SubscriptionPlan {
  id: string;
  name: string;
  type: 'free' | 'basic' | 'premium' | 'enterprise';
  price: number;
  currency: string;
  billingInterval: 'month' | 'year';
  features: string[];
  limits: Record<string, number>;
  stripeProductId?: string;
  stripePriceId?: string;
  isActive: boolean;
}

export const usePlans = () => {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/subscription-plans?isActive=true', {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPlans(data.data);
      } else {
        throw new Error('Failed to fetch plans');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return { plans, loading, error, refetch: fetchPlans };
};
```

### 2. Plan Selection Component

```tsx
// components/PlanSelection.tsx
import React from 'react';
import { SubscriptionPlan } from '../types/subscription';

interface PlanSelectionProps {
  plans: SubscriptionPlan[];
  currentPlan?: SubscriptionPlan;
  onSelectPlan: (plan: SubscriptionPlan) => void;
  loading?: boolean;
}

export const PlanSelection: React.FC<PlanSelectionProps> = ({
  plans,
  currentPlan,
  onSelectPlan,
  loading = false,
}) => {
  const formatPrice = (price: number, currency: string, interval: string) => {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    });
    return `${formatter.format(price / 100)}/${interval}`;
  };

  const isCurrentPlan = (plan: SubscriptionPlan) => {
    return currentPlan?.id === plan.id;
  };

  const canUpgrade = (plan: SubscriptionPlan) => {
    if (!currentPlan) return plan.type !== 'free';

    const planHierarchy = { free: 0, basic: 1, premium: 2, enterprise: 3 };
    return planHierarchy[plan.type] > planHierarchy[currentPlan.type];
  };

  if (loading) {
    return <div className="flex justify-center py-8">Loading plans...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {plans.map(plan => (
        <div
          key={plan.id}
          className={`border rounded-lg p-6 ${
            isCurrentPlan(plan)
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <div className="mb-4">
            <h3 className="text-xl font-semibold">{plan.name}</h3>
            <div className="text-2xl font-bold text-gray-900">
              {plan.price === 0
                ? 'Free'
                : formatPrice(plan.price, plan.currency, plan.billingInterval)}
            </div>
          </div>

          <ul className="mb-6 space-y-2">
            {plan.features.map((feature, index) => (
              <li key={index} className="flex items-center text-sm">
                <svg
                  className="w-4 h-4 text-green-500 mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                {feature}
              </li>
            ))}
          </ul>

          <button
            onClick={() => onSelectPlan(plan)}
            disabled={isCurrentPlan(plan) || (!canUpgrade(plan) && currentPlan)}
            className={`w-full py-2 px-4 rounded-md font-medium ${
              isCurrentPlan(plan)
                ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                : canUpgrade(plan) || !currentPlan
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-100 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isCurrentPlan(plan)
              ? 'Current Plan'
              : canUpgrade(plan) || !currentPlan
                ? plan.type === 'free'
                  ? 'Start Free'
                  : 'Upgrade'
                : 'Downgrade Not Available'}
          </button>
        </div>
      ))}
    </div>
  );
};
```

## Payment Method Setup

### 1. Payment Form Component

```tsx
// components/PaymentForm.tsx
import React, { useState } from 'react';
import { useStripe, useElements, CardElement, Elements } from '@stripe/react-stripe-js';
import { stripePromise } from '../lib/stripe';

interface PaymentFormProps {
  onPaymentMethodSetup: (paymentMethodId: string) => void;
  loading?: boolean;
}

const PaymentFormInner: React.FC<PaymentFormProps> = ({
  onPaymentMethodSetup,
  loading = false,
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);
    setError(null);

    const card = elements.getElement(CardElement);
    if (!card) {
      setError('Card element not found');
      setProcessing(false);
      return;
    }

    try {
      // Create payment method
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card,
      });

      if (stripeError) {
        setError(stripeError.message || 'An error occurred');
        return;
      }

      if (paymentMethod) {
        onPaymentMethodSetup(paymentMethod.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border rounded-md">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': {
                  color: '#aab7c4',
                },
              },
            },
          }}
        />
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <button
        type="submit"
        disabled={!stripe || processing || loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {processing ? 'Processing...' : 'Setup Payment Method'}
      </button>
    </form>
  );
};

export const PaymentForm: React.FC<PaymentFormProps> = props => (
  <Elements stripe={stripePromise}>
    <PaymentFormInner {...props} />
  </Elements>
);
```

## Subscription Creation

### 1. Subscription Creation Hook

```typescript
// hooks/useSubscriptionCreation.ts
import { useState } from 'react';

interface CreateSubscriptionParams {
  planId: string;
  paymentMethodId?: string;
}

export const useSubscriptionCreation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSubscription = async (params: CreateSubscriptionParams) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/v1/user-subscriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create subscription');
      }

      const data = await response.json();
      return data.data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { createSubscription, loading, error };
};
```

### 2. Subscription Creation Flow Component

```tsx
// components/SubscriptionFlow.tsx
import React, { useState } from 'react';
import { SubscriptionPlan } from '../types/subscription';
import { PaymentForm } from './PaymentForm';
import { useSubscriptionCreation } from '../hooks/useSubscriptionCreation';

interface SubscriptionFlowProps {
  selectedPlan: SubscriptionPlan;
  onSuccess: () => void;
  onCancel: () => void;
}

export const SubscriptionFlow: React.FC<SubscriptionFlowProps> = ({
  selectedPlan,
  onSuccess,
  onCancel,
}) => {
  const [step, setStep] = useState<'payment' | 'processing' | 'success'>('payment');
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const { createSubscription, loading, error } = useSubscriptionCreation();

  const handlePaymentMethodSetup = async (pmId: string) => {
    setPaymentMethodId(pmId);
    setStep('processing');

    try {
      await createSubscription({
        planId: selectedPlan.id,
        paymentMethodId: selectedPlan.type === 'free' ? undefined : pmId,
      });

      setStep('success');
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      setStep('payment');
    }
  };

  const handleFreePlanSelection = async () => {
    setStep('processing');

    try {
      await createSubscription({
        planId: selectedPlan.id,
      });

      setStep('success');
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      setStep('payment');
    }
  };

  if (step === 'processing') {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Creating your subscription...</p>
      </div>
    );
  }

  if (step === 'success') {
    return (
      <div className="text-center py-8">
        <div className="text-green-600 text-6xl mb-4">✓</div>
        <h3 className="text-xl font-semibold mb-2">Subscription Created!</h3>
        <p>Welcome to {selectedPlan.name}. Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6">
        <h3 className="text-xl font-semibold mb-2">Subscribe to {selectedPlan.name}</h3>
        <p className="text-gray-600">
          {selectedPlan.price === 0
            ? 'Start with our free plan'
            : `$${selectedPlan.price / 100}/${selectedPlan.billingInterval}`}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {selectedPlan.type === 'free' ? (
        <div className="space-y-4">
          <p>No payment required for the free plan.</p>
          <button
            onClick={handleFreePlanSelection}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Start Free Plan'}
          </button>
        </div>
      ) : (
        <PaymentForm onPaymentMethodSetup={handlePaymentMethodSetup} loading={loading} />
      )}

      <button
        onClick={onCancel}
        className="w-full mt-4 bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300"
      >
        Cancel
      </button>
    </div>
  );
};
```

## Subscription Management

### 1. Subscription Dashboard Component

```tsx
// components/SubscriptionDashboard.tsx
import React from 'react';
import { useSubscription } from '../hooks/useSubscription';
import { usePlans } from '../hooks/usePlans';

export const SubscriptionDashboard: React.FC = () => {
  const { subscription, loading: subLoading, refetch } = useSubscription();
  const { plans, loading: plansLoading } = usePlans();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'trialing':
        return 'text-blue-600 bg-blue-100';
      case 'canceled':
        return 'text-red-600 bg-red-100';
      case 'past_due':
        return 'text-yellow-600 bg-yellow-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  if (subLoading || plansLoading) {
    return <div className="text-center py-8">Loading...</div>;
  }

  if (!subscription) {
    return (
      <div className="text-center py-8">
        <p className="mb-4">No active subscription found.</p>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
          Choose a Plan
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Current Subscription */}
      <div className="bg-white border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Current Subscription</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
            <p className="text-lg font-semibold">{subscription.plan.name}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <span
              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(
                subscription.status,
              )}`}
            >
              {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Next Billing Date
            </label>
            <p>{formatDate(subscription.currentPeriodEnd)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Cost</label>
            <p className="text-lg font-semibold">
              {subscription.plan.price === 0 ? 'Free' : `$${subscription.plan.price / 100}`}
            </p>
          </div>
        </div>
      </div>

      {/* Plan Features */}
      <div className="bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Included Features</h3>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {subscription.plan.features.map((feature, index) => (
            <li key={index} className="flex items-center text-sm">
              <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <button className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">
          Upgrade Plan
        </button>

        <button className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700">
          Manage Billing
        </button>

        {subscription.status === 'active' && (
          <button className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700">
            Cancel Subscription
          </button>
        )}
      </div>
    </div>
  );
};
```

## Upgrade/Downgrade Flow

### 1. Upgrade Options Hook

```typescript
// hooks/useUpgrade.ts
import { useState } from 'react';

interface UpgradeOption {
  planId: string;
  plan: {
    id: string;
    name: string;
    type: string;
    price: number;
    currency: string;
    billingInterval: string;
    features: string[];
  };
  proratedAmount: number;
  effectiveDate: string;
}

export const useUpgrade = () => {
  const [upgradeOptions, setUpgradeOptions] = useState<UpgradeOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUpgradeOptions = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/v1/user-subscriptions/upgrade-options', {
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch upgrade options');
      }

      const data = await response.json();
      setUpgradeOptions(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const upgradePlan = async (
    planId: string,
    prorationBehavior: 'create_prorations' | 'none' = 'create_prorations',
  ) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/v1/user-subscriptions/upgrade', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          prorationBehavior,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to upgrade plan');
      }

      const data = await response.json();
      return data.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    upgradeOptions,
    fetchUpgradeOptions,
    upgradePlan,
    loading,
    error,
  };
};
```

### 2. Upgrade Flow Component

```tsx
// components/UpgradeFlow.tsx
import React, { useState, useEffect } from 'react';
import { useUpgrade } from '../hooks/useUpgrade';
import { useSubscription } from '../hooks/useSubscription';

export const UpgradeFlow: React.FC = () => {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { upgradeOptions, fetchUpgradeOptions, upgradePlan, loading, error } = useUpgrade();
  const { refetch: refetchSubscription } = useSubscription();

  useEffect(() => {
    fetchUpgradeOptions();
  }, []);

  const handleUpgrade = async () => {
    if (!selectedPlanId) return;

    try {
      await upgradePlan(selectedPlanId);
      await refetchSubscription();
      setShowConfirmation(false);
      setSelectedPlanId(null);
      // Show success message or redirect
    } catch (err) {
      // Error is handled by the hook
    }
  };

  const selectedOption = upgradeOptions.find(option => option.planId === selectedPlanId);

  if (loading && !upgradeOptions.length) {
    return <div className="text-center py-8">Loading upgrade options...</div>;
  }

  if (!upgradeOptions.length) {
    return (
      <div className="text-center py-8">
        <p>No upgrade options available.</p>
      </div>
    );
  }

  if (showConfirmation && selectedOption) {
    return (
      <div className="max-w-md mx-auto bg-white border rounded-lg p-6">
        <h3 className="text-lg font-semibold mb-4">Confirm Upgrade</h3>

        <div className="space-y-3 mb-6">
          <div className="flex justify-between">
            <span>New Plan:</span>
            <span className="font-semibold">{selectedOption.plan.name}</span>
          </div>

          <div className="flex justify-between">
            <span>Monthly Price:</span>
            <span className="font-semibold">
              ${selectedOption.plan.price / 100}/{selectedOption.plan.billingInterval}
            </span>
          </div>

          {selectedOption.proratedAmount > 0 && (
            <div className="flex justify-between">
              <span>Prorated Amount:</span>
              <span className="font-semibold">${selectedOption.proratedAmount / 100}</span>
            </div>
          )}

          <div className="flex justify-between">
            <span>Effective Date:</span>
            <span>{new Date(selectedOption.effectiveDate).toLocaleDateString()}</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="flex space-x-3">
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Upgrading...' : 'Confirm Upgrade'}
          </button>

          <button
            onClick={() => {
              setShowConfirmation(false);
              setSelectedPlanId(null);
            }}
            className="flex-1 bg-gray-200 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Upgrade Your Plan</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {upgradeOptions.map(option => (
          <div
            key={option.planId}
            className={`border rounded-lg p-4 cursor-pointer transition-colors ${
              selectedPlanId === option.planId
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => setSelectedPlanId(option.planId)}
          >
            <h3 className="font-semibold text-lg">{option.plan.name}</h3>
            <p className="text-2xl font-bold text-gray-900 mb-2">
              ${option.plan.price / 100}/{option.plan.billingInterval}
            </p>

            {option.proratedAmount > 0 && (
              <p className="text-sm text-gray-600 mb-2">
                Prorated charge: ${option.proratedAmount / 100}
              </p>
            )}

            <ul className="text-sm space-y-1">
              {option.plan.features.slice(0, 3).map((feature, index) => (
                <li key={index} className="flex items-center">
                  <svg
                    className="w-3 h-3 text-green-500 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {feature}
                </li>
              ))}
              {option.plan.features.length > 3 && (
                <li className="text-gray-500">+{option.plan.features.length - 3} more features</li>
              )}
            </ul>
          </div>
        ))}
      </div>

      <button
        onClick={() => setShowConfirmation(true)}
        disabled={!selectedPlanId || loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        Continue to Upgrade
      </button>
    </div>
  );
};
```

## Billing Portal Integration

### 1. Billing Portal Hook

```typescript
// hooks/useBillingPortal.ts
import { useState } from 'react';

export const useBillingPortal = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openBillingPortal = async (returnUrl?: string) => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/v1/stripe/billing-portal', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          returnUrl: returnUrl || window.location.href,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create billing portal session');
      }

      const data = await response.json();

      // Redirect to Stripe billing portal
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return { openBillingPortal, loading, error };
};
```

## Error Handling

### 1. Error Types and Handling

```typescript
// types/errors.ts
export interface ApiError {
  message: string;
  statusCode: number;
  error?: string;
}

export class SubscriptionError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public originalError?: any,
  ) {
    super(message);
    this.name = 'SubscriptionError';
  }
}

// utils/errorHandling.ts
export const handleApiError = (error: any): string => {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }

  if (error.message) {
    return error.message;
  }

  return 'An unexpected error occurred';
};

export const isSubscriptionError = (error: any): boolean => {
  return (
    error instanceof SubscriptionError ||
    error.response?.status === 402 || // Payment Required
    error.response?.status === 403
  ); // Forbidden (subscription expired)
};
```

### 2. Error Boundary Component

```tsx
// components/SubscriptionErrorBoundary.tsx
import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class SubscriptionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Subscription error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="text-center py-8">
            <div className="text-red-600 text-6xl mb-4">⚠️</div>
            <h3 className="text-xl font-semibold mb-2">Something went wrong</h3>
            <p className="text-gray-600 mb-4">
              There was an error with your subscription. Please try again.
            </p>
            <button
              onClick={() => this.setState({ hasError: false })}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Try Again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}
```

## Code Examples

### 1. Complete App Integration

```tsx
// App.tsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SubscriptionErrorBoundary } from './components/SubscriptionErrorBoundary';
import { SubscriptionDashboard } from './components/SubscriptionDashboard';
import { PlanSelection } from './components/PlanSelection';
import { UpgradeFlow } from './components/UpgradeFlow';

function App() {
  return (
    <SubscriptionErrorBoundary>
      <Router>
        <div className="min-h-screen bg-gray-50">
          <Routes>
            <Route path="/subscription" element={<SubscriptionDashboard />} />
            <Route path="/plans" element={<PlanSelection />} />
            <Route path="/upgrade" element={<UpgradeFlow />} />
          </Routes>
        </div>
      </Router>
    </SubscriptionErrorBoundary>
  );
}

export default App;
```

### 2. Auth Token Helper

```typescript
// utils/auth.ts
export const getAuthToken = (): string => {
  // Get token from your auth system (localStorage, cookies, context, etc.)
  return localStorage.getItem('authToken') || '';
};

export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};
```

### 3. API Client Configuration

```typescript
// lib/api.ts
import { getAuthToken } from '../utils/auth';

export const apiClient = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1',

  async request(endpoint: string, options: RequestInit = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = getAuthToken();

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
      ...options,
    };

    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return response.json();
  },

  get(endpoint: string, options?: RequestInit) {
    return this.request(endpoint, { ...options, method: 'GET' });
  },

  post(endpoint: string, data?: any, options?: RequestInit) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  put(endpoint: string, data?: any, options?: RequestInit) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  delete(endpoint: string, options?: RequestInit) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  },
};
```

## Next Steps

1. **Testing**: Implement unit and integration tests for subscription flows
2. **Analytics**: Add tracking for subscription events and user behavior
3. **Notifications**: Implement in-app notifications for subscription changes
4. **Mobile**: Adapt components for mobile-responsive design
5. **Accessibility**: Ensure all components meet accessibility standards

## Security Considerations

1. **Token Security**: Always use secure token storage and transmission
2. **Input Validation**: Validate all user inputs on both frontend and backend
3. **Error Handling**: Don't expose sensitive information in error messages
4. **HTTPS**: Always use HTTPS in production for payment processing
5. **PCI Compliance**: Use Stripe Elements to avoid handling card data directly

This guide provides a complete foundation for implementing subscription workflows on the frontend. Customize the components and flows based on your specific UI framework and design requirements.
