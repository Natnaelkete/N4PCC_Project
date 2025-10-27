# N4PCC Collaboration Platform

A full-stack collaborative project management platform with JWT authentication, GraphQL/REST API, real-time subscriptions, and comprehensive security features.

## Features

- 🔐 **JWT Authentication** - Access and Refresh token system with HTTP-only cookies
- 👥 **User Management** - Complete user lifecycle with admin ban/unban capabilities
- 🏢 **Workspaces** - Hierarchical workspace management with role-based access control
- 📋 **Projects & Tasks** - Full CRUD operations with task assignments and status tracking
- 🔔 **Real-time Notifications** - GraphQL subscriptions for live updates
- 📝 **Dual Logging** - File-based and database audit logging
- 🤖 **AI Integration** - Gemini API integration for task summarization and generation
- 🚀 **Docker Support** - Complete dockerized deployment
- ⚡ **Graceful Shutdown** - Proper resource cleanup on termination

## Tech Stack

- **Runtime**: Bun 1.0+
- **Framework**: Express.js
- **Database**: PostgreSQL 16
- **API**: GraphQL (Apollo Server) + REST endpoints
- **Authentication**: JWT with bcrypt password hashing
- **Real-time**: GraphQL Subscriptions
- **Logging**: Winston
- **AI**: Google Gemini API

## Getting Started

### Prerequisites

- Bun 1.0 or higher
- PostgreSQL 16 or higher
- Docker (optional, for containerized deployment)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd n4pcc-project
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run database migrations:
```bash
bun run db:migrate
```

5. Seed the database (optional):
```bash
bun run db:seed
```

6. Start the development server:
```bash
bun run dev
```

### Docker Deployment

To run the entire stack with Docker:

```bash
docker-compose up -d
```

This will start:
- PostgreSQL database on port 5432
- Application server on port 4000

## API Documentation

### GraphQL Endpoint

Access the GraphQL playground at: `http://localhost:4000/graphql`

### REST Endpoints

#### Authentication

- `POST /api/auth/login` - Login with email and password
- `POST /api/auth/logout` - Logout and invalidate refresh token
- `POST /api/auth/refresh` - Refresh access token

#### Example Login Request

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "user123"
  }'
```

### GraphQL Queries

#### Register a User

```graphql
mutation Register {
  register(email: "newuser@example.com", password: "password123", full_name: "New User") {
    accessToken
    refreshToken
    user {
      id
      email
      full_name
    }
  }
}
```

#### Create a Workspace

```graphql
mutation CreateWorkspace {
  createWorkspace(name: "My Workspace", description: "A test workspace") {
    id
    name
    description
    created_at
  }
}
```

#### Create a Task

```graphql
mutation CreateTask {
  createTask(
    projectId: "project-id-here"
    title: "Complete backend tests"
    description: "Write comprehensive tests"
    assignedToIds: ["user-id-here"]
  ) {
    id
    title
    status
  }
}
```

#### Subscribe to Task Updates

```graphql
subscription TaskUpdates {
  taskStatusUpdated(workspaceId: "workspace-id-here") {
    id
    title
    status
  }
}
```

## Authorization Model

### Workspace Roles

- **Owner** - Full CRUD rights, can manage members and assign roles
- **Member** - Can create/edit/delete projects and tasks
- **Viewer** - Read-only access

### Project Roles

- **Project Lead** - Can manage project membership, edit all tasks, delete project
- **Contributor** - Can create, edit, and update task status
- **Project Viewer** - Read-only access

## Database Schema

The application uses the following main entities:

- Users
- Workspaces
- Workspace Members
- Projects
- Project Members
- Tasks
- Task Assignments
- Notifications
- Audit Logs
- User Devices

See `src/db/schema.sql` for the complete schema.

## Testing

Run the test suite:

```bash
# Run all tests
bun test

# Run with coverage
bun run test:coverage

# Run specific test file
bun test src/__tests__/auth.test.ts
```

## Logging

The application implements dual logging:

1. **File Logging**: All logs are written to `audit.log`
2. **Database Logging**: Security-sensitive events are logged to the `audit_logs` table

Log categories:
- `info` - General information
- `warn` - Warnings
- `error` - Errors
- `security` - Security-related events

## AI Features (Bonus)

### Summarize Task

```graphql
query Summarize {
  summarizeTask(taskDescription: "Very long task description here...")
}
```

### Generate Tasks from Prompt

```graphql
mutation GenerateTasks {
  generateTasksFromPrompt(
    prompt: "Create a plan for launching a website"
    projectId: "project-id-here"
  ) {
    id
    title
    description
  }
}
```

## Development

### Project Structure

```
src/
├── db/
│   ├── connection.ts
│   ├── migrate.ts
│   ├── schema.sql
│   └── seed.ts
├── graphql/
│   ├── schema.ts
│   └── resolvers.ts
├── middleware/
│   └── auth.ts
├── routes/
│   └── auth.ts
├── services/
│   ├── authorization.ts
│   └── notifications.ts
├── utils/
│   ├── auth.ts
│   └── logger.ts
├── config/
│   └── index.ts
└── index.ts
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | - |
| `JWT_SECRET` | Secret for access token signing | - |
| `JWT_REFRESH_SECRET` | Secret for refresh token signing | - |
| `JWT_EXPIRES_IN` | Access token expiration | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiration | `7d` |
| `PORT` | Server port | `4000` |
| `NODE_ENV` | Environment mode | `development` |
| `GEMINI_API_KEY` | Google Gemini API key | - |

## Security Features

- Password hashing with bcrypt (12 rounds)
- JWT token-based authentication
- HTTP-only refresh token cookies
- Rate limiting on auth endpoints
- Device tracking for session management
- Comprehensive audit logging
- SQL injection prevention
- XSS protection
- CORS configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write tests for new features
5. Run the test suite
6. Submit a pull request

## License

This project is part of a technical assessment.

## Support

For issues and questions, please open an issue on the repository.



