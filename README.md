# ProjectDeployer Backend API

The backend API for ProjectDeployer platform that handles project management, user authentication, license management, and deployment operations.

## Architecture Overview

The backend follows a modular architecture with clear separation of concerns to ensure scalability and maintainability.

## Modules

### 1. Authentication Module

Handles all user authentication and authorization processes using Firebase Authentication.

- User registration and login via Firebase
- Integration with Firebase Auth services
- Role-based access control (project owners vs users)
- OAuth integration for social logins
- Password recovery and account management
- Security rules and permissions

### 2. Project Management Module

Manages all aspects of projects within the platform.

- Project creation, reading, updating, and deletion
- Project metadata storage (tech stack, description, etc.)
- Project versioning
- Project search and filtering
- Project analytics and statistics

### 3. License Management Module

Handles the creation and enforcement of project licenses.

- License creation and template management
- License purchasing and activation
- License validation and enforcement
- Usage tracking and limitations
- License renewal processes

### 4. Deployment Module

Manages the deployment process across different platforms.

- Deployment configuration management
- GitHub Actions generation and execution
- Integration with deployment providers (Netlify, Vercel, etc.)
- Deployment status tracking and logging
- Deployment rollback capabilities

### 5. Payment Module

Handles all financial transactions within the platform.

- Payment processing integration
- Invoice generation
- Subscription management
- Refund processing
- Financial reporting

### 6. Notification Module

Manages communication with users regarding system events.

- Email notifications
- In-app alerts
- Deployment status updates
- License expiration warnings
- Custom notification preferences
  - Project updates notifications
  - Deployment alerts
  - License expiration alerts
  - Marketing communications
- User-configurable notification settings

### 7. Analytics Module

Collects and processes usage and performance data.

- User activity tracking
- Deployment performance metrics
- Project popularity statistics
- License usage analytics
- API performance monitoring

## API Endpoints

The API follows RESTful principles with the following main endpoint groups:

- `/api/auth` - Authentication endpoints
- `/api/projects` - Project management endpoints
- `/api/licenses` - License management endpoints
- `/api/deployments` - Deployment operation endpoints
- `/api/payments` - Payment processing endpoints
- `/api/notifications` - Notification management endpoints
- `/api/analytics` - Analytics data endpoints

## Technical Stack

- **Framework**: Node.js with Express/NestJS
- **Database**: PostgreSQL for relational data
- **Authentication**: Firebase Authentication
- **GitHub Integration**: GitHub API, Octokit
- **Deployment Integrations**: API integrations with Netlify, Vercel, etc.
- **Payment Processing**: Stripe/PayPal integration
- **Documentation**: Swagger/OpenAPI
- **Error Monitoring**: Sentry
- **Testing**: Jest for unit and integration tests
- **CI/CD**: GitHub Actions

## Development Setup

### Prerequisites

- Node.js (v18+)
- PostgreSQL
- MongoDB
- GitHub account with API access
- Accounts with deployment platforms for testing

### Installation

```bash
# Clone the repository
git clone https://github.com/Nebur242/deploy-hub-api.git

# Install dependencies
cd deploy-hub-api

npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run start:dev
```

A complete `.env.example` file is included in the repository with all required variables.

### Environment Variables

The application requires the following environment variables:

#### Core Application

- `NODE_ENV` - Environment ('development', 'production', or 'local')
- `NODE_TLS_REJECT_UNAUTHORIZED` - SSL verification setting
- `PORT` - Server port number

#### Firebase Integration

- `FIREBASE_AUTH_PROVIDER_X509_CERT_URL` - Firebase auth provider cert URL
- `FIREBASE_AUTH_URI` - Firebase authentication URI
- `FIREBASE_CLIENT_EMAIL` - Firebase service account email
- `FIREBASE_CLIENT_X509_CERT_URL` - Firebase client cert URL
- `FIREBASE_PROJECT_ID` - Firebase project identifier
- `FIREBASE_STORAGE_BUCKET` - Firebase storage bucket name
- `FIREBASE_TOKEN_URI` - Firebase token URI
- `FIREBASE_TYPE` - Service account type
- `FIREBASE_PRIVATE_KEY` - Firebase private key
- `FIREBASE_PRIVATE_KEY_ID` - Firebase private key ID
- `FIREBASE_REST_API_KEY` - Firebase REST API key
- `FIREBASE_CLIENT_ID` - Firebase client ID

#### Database

- `DB_HOST` - Database host address
- `DB_LOGGING` - Database query logging flag
- `DB_NAME` - Database name
- `DB_PORT` - Database port
- `DB_SSL` - SSL connection flag
- `DB_SYNC` - Entity synchronization flag
- `DB_TYPE` - Database type ('postgres')
- `DB_USERNAME` - Database username
- `DB_PASSWORD` - Database password

#### PGAdmin (for development)

- `PGADMIN_DEFAULT_EMAIL` - PGAdmin default email
- `PGADMIN_DEFAULT_PASSWORD` - PGAdmin default password

#### Monitoring

- `SENTRY_DSN` - Sentry error tracking endpoint

## API Documentation

API documentation is available at `/api/docs` when running the server, powered by Swagger/OpenAPI.

## Testing

```bash
# Run unit tests
npm run test

# Run coverage tests
npm run test:cov
```

## Deployment

The API can be deployed using Docker:

```bash
# Build Docker image
docker build -t projectdeployer-backend .

# Run container
docker run -p 3000:3000 projectdeployer-backend
```

## Monitoring and Logging

- Error tracking and monitoring with Sentry
- Application performance monitoring
- Structured logging with contextual information
- Real-time alerts and notifications for critical issues
- Detailed error reports with stack traces and context

## Contributing

Please follow the contribution guidelines in the main project README.

## Security Considerations

- All API endpoints are protected with appropriate authentication
- Rate limiting is implemented to prevent abuse
- Input validation is enforced on all endpoints
- Regular security audits are conducted
