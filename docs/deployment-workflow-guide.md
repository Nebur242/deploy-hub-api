# Deployment Workflow Guide

This guide explains how to set up your GitHub Actions workflow to work with Deploy Hub.

## Overview

Deploy Hub triggers your GitHub workflow via `workflow_dispatch` and monitors the deployment status. To capture the deployment URL, your workflow must output it in a specific format.

## Required Output Format

**Add this line to your workflow after deployment:**

```bash
echo "🔗 Deployment URL: https://your-deployment-url.vercel.app"
```

Deploy Hub recognizes multiple URL patterns (see [Supported Patterns](#supported-url-patterns) below).

---

## Complete Workflow Examples

### Vercel Deployment

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  workflow_dispatch:
    inputs:
      BRANCH:
        description: 'Branch to deploy'
        required: true
        default: 'main'
      ENVIRONMENT:
        description: 'Environment'
        required: true
        default: 'preview'

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: ${{ inputs.BRANCH }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Vercel CLI
        run: npm install -g vercel

      - name: Pull Vercel Environment
        run: vercel pull --yes --environment=${{ inputs.ENVIRONMENT }} --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build Project
        run: vercel build ${{ inputs.ENVIRONMENT == 'production' && '--prod' || '' }} --token=${{ secrets.VERCEL_TOKEN }}

      - name: Deploy to Vercel
        id: deploy
        run: |
          # Deploy and capture output
          if [ "${{ inputs.ENVIRONMENT }}" == "production" ]; then
            DEPLOYMENT_URL=$(vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }} 2>&1 | tail -1)
          else
            DEPLOYMENT_URL=$(vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }} 2>&1 | tail -1)
          fi

          # Output the URL for Deploy Hub to capture
          echo ""
          echo "=========================================="
          echo "🔗 Deployment URL: $DEPLOYMENT_URL"
          echo "=========================================="
```

### Netlify Deployment

```yaml
# .github/workflows/deploy.yml
name: Deploy to Netlify

on:
  workflow_dispatch:
    inputs:
      BRANCH:
        description: 'Branch to deploy'
        required: true
        default: 'main'
      ENVIRONMENT:
        description: 'Environment'
        required: true
        default: 'preview'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: ${{ inputs.BRANCH }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Install Netlify CLI
        run: npm install -g netlify-cli

      - name: Deploy to Netlify
        id: deploy
        run: |
          # Set production flag
          PROD_FLAG=""
          if [ "${{ inputs.ENVIRONMENT }}" == "production" ]; then
            PROD_FLAG="--prod"
          fi

          # Deploy with JSON output
          NETLIFY_OUTPUT=$(netlify deploy $PROD_FLAG \
            --dir=dist \
            --auth=${{ secrets.NETLIFY_AUTH_TOKEN }} \
            --site=${{ secrets.NETLIFY_SITE_ID }} \
            --json)

          # Extract URL based on environment
          if [ "${{ inputs.ENVIRONMENT }}" == "production" ]; then
            DEPLOYMENT_URL=$(echo "$NETLIFY_OUTPUT" | jq -r '.url')
          else
            DEPLOYMENT_URL=$(echo "$NETLIFY_OUTPUT" | jq -r '.deploy_url')
          fi

          # Output the URL for Deploy Hub to capture
          echo ""
          echo "=========================================="
          echo "🔗 Deployment URL: $DEPLOYMENT_URL"
          echo "=========================================="
```

### Using Vercel GitHub Action

```yaml
name: Deploy to Vercel (Action)

on:
  workflow_dispatch:
    inputs:
      BRANCH:
        description: 'Branch to deploy'
        required: true
      ENVIRONMENT:
        description: 'Environment'
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: ${{ inputs.BRANCH }}

      - name: Deploy to Vercel
        id: vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: ${{ inputs.ENVIRONMENT == 'production' && '--prod' || '' }}

      - name: Output Deployment URL
        run: |
          echo ""
          echo "=========================================="
          echo "🔗 Deployment URL: ${{ steps.vercel.outputs.preview-url }}"
          echo "=========================================="
```

### Using Netlify GitHub Action

```yaml
name: Deploy to Netlify (Action)

on:
  workflow_dispatch:
    inputs:
      BRANCH:
        description: 'Branch to deploy'
        required: true
      ENVIRONMENT:
        description: 'Environment'
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: ${{ inputs.BRANCH }}

      - name: Setup & Build
        run: |
          npm ci
          npm run build

      - name: Deploy to Netlify
        id: netlify
        uses: nwtgck/actions-netlify@v2
        with:
          publish-dir: './dist'
          production-deploy: ${{ inputs.ENVIRONMENT == 'production' }}
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}

      - name: Output Deployment URL
        run: |
          echo ""
          echo "=========================================="
          echo "🔗 Deployment URL: ${{ steps.netlify.outputs.deploy-url }}"
          echo "=========================================="
```

---

## Supported URL Patterns

Deploy Hub automatically detects deployment URLs from the following patterns in your workflow logs:

### Recommended (Universal)

```bash
🔗 Deployment URL: https://example.com
Deployment URL: https://example.com
```

### Vercel-Specific

```bash
Preview: https://project-abc123.vercel.app
Production: https://project.vercel.app
Deployed to: https://project-abc123.vercel.app
```

### Netlify-Specific

```bash
Website URL: https://project.netlify.app
Deploy URL: https://abc123--project.netlify.app
Unique Deploy URL: https://abc123--project.netlify.app
```

### Generic

```bash
Live URL: https://example.com
Site URL: https://example.com
Published to: https://example.com
```

---

## Required Secrets

### For Vercel

| Secret              | Description          | How to Get                                                           |
| ------------------- | -------------------- | -------------------------------------------------------------------- |
| `VERCEL_TOKEN`      | Vercel API Token     | [Vercel Dashboard](https://vercel.com/account/tokens) → Create Token |
| `VERCEL_ORG_ID`     | Organization/Team ID | `vercel link` → check `.vercel/project.json`                         |
| `VERCEL_PROJECT_ID` | Project ID           | `vercel link` → check `.vercel/project.json`                         |

### For Netlify

| Secret               | Description                   | How to Get                                                                                  |
| -------------------- | ----------------------------- | ------------------------------------------------------------------------------------------- |
| `NETLIFY_AUTH_TOKEN` | Netlify Personal Access Token | [Netlify User Settings](https://app.netlify.com/user/applications) → Personal Access Tokens |
| `NETLIFY_SITE_ID`    | Site API ID                   | Site Settings → General → Site Information                                                  |

---

## Workflow Inputs

Your workflow should accept these inputs via `workflow_dispatch`:

| Input         | Description                                        | Required |
| ------------- | -------------------------------------------------- | -------- |
| `BRANCH`      | Git branch to deploy                               | Yes      |
| `ENVIRONMENT` | Deployment environment (`production` or `preview`) | Yes      |

Additional inputs from your environment variables will also be passed.

---

## Troubleshooting

### URL Not Captured

1. Ensure your workflow outputs the URL with the correct pattern
2. Check that the deployment step completes successfully
3. Look for the URL in the workflow logs manually

### Deployment Fails

1. Verify your secrets are correctly set in GitHub repository settings
2. Check that the Vercel/Netlify project is properly linked
3. Review the workflow logs for specific error messages

### Best Practices

1. Always use secrets for tokens - never hardcode them
2. Use `workflow_dispatch` with inputs for flexibility
3. Add the deployment URL output at the end of your deployment step
4. Include the `========` separators to make URLs easy to find in logs

---

## Example: Full Workflow with Error Handling

```yaml
name: Deploy

on:
  workflow_dispatch:
    inputs:
      BRANCH:
        description: 'Branch'
        required: true
      ENVIRONMENT:
        description: 'Environment'
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.BRANCH }}

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install & Build
        run: |
          npm ci
          npm run build

      - name: Deploy
        id: deploy
        run: |
          npm i -g vercel

          set +e  # Don't exit on error

          if [ "${{ inputs.ENVIRONMENT }}" == "production" ]; then
            OUTPUT=$(vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }} 2>&1)
          else
            OUTPUT=$(vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }} 2>&1)
          fi

          EXIT_CODE=$?

          # Extract URL from output
          DEPLOYMENT_URL=$(echo "$OUTPUT" | grep -oE 'https://[a-zA-Z0-9-]+\.vercel\.app' | head -1)

          if [ $EXIT_CODE -ne 0 ]; then
            echo "❌ Deployment failed!"
            echo "$OUTPUT"
            exit 1
          fi

          echo ""
          echo "=========================================="
          echo "✅ Deployment successful!"
          echo "🔗 Deployment URL: $DEPLOYMENT_URL"
          echo "=========================================="
```

---

## Need Help?

Contact support if you need assistance setting up your deployment workflow.
