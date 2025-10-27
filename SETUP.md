# Setup Instructions

## Quick Start

### 1. Install Bun

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Or via npm
npm install -g bun
```

### 2. Install Dependencies

```bash
bun install
```

### 3. Set Up Database

#### Option A: Local PostgreSQL

```bash
# Create database
createdb collaboration_platform

# Or using Docker
docker run -d --name postgres \
  -e POSTGRES_USER=user \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=collaboration_platform \
  -p 5432:5432 \
  postgres:16-alpine
```

#### Option B: Docker Compose

```bash
docker-compose up -d postgres
```

### 4. Configure Environment

```bash
# Copy the template
cp ENV_TEMPLATE.txt .env

# Edit .env with your database URL
# DATABASE_URL=postgresql://user:password@localhost:5432/collaboration_platform
```

### 5. Run Migrations

```bash
bun run db:migrate
```

### 6. Seed Database (Optional)

```bash
bun run db:seed
```

This creates:
- Admin user: `admin@example.com` / `admin123`
- Test user: `user@example.com` / `user123`

### 7. Start the Server

```bash
bun run dev
```

The server will start on `http://localhost:4000`

## Testing the API

### GraphQL Playground

Visit: http://localhost:4000/graphql

### Example: Register a User

```graphql
mutation {
  register(email: "test@example.com", password: "password123", full_name: "Test User") {
    accessToken
    user {
      id
      email
      full_name
    }
  }
}
```

### Example: Login via REST

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "user123"
  }'
```

### Example: Create Workspace

```graphql
mutation {
  createWorkspace(name: "My Workspace", description: "Team workspace") {
    id
    name
    description
  }
}
```

## Project Structure

```
src/
├── db/              # Database setup and migrations
├── graphql/         # GraphQL schema and resolvers
├── middleware/      # Express middleware
├── routes/          # REST API routes
├── services/        # Business logic services
├── utils/           # Utility functions
├── config/          # Configuration
├── __tests__/       # Test files
└── index.ts         # Entry point
```

## Development

### Run Tests

```bash
bun test
```

### Check Code Quality

```bash
bun run lint
```

### Format Code

```bash
bun run format
```

## Troubleshooting

### Database Connection Errors

1. Check if PostgreSQL is running: `docker ps` or `pg_isready`
2. Verify DATABASE_URL in `.env`
3. Check database logs: `docker logs <container-name>`

### Port Already in Use

```bash
# Find process using port 4000
lsof -i :4000

# Kill the process
kill -9 <PID>
```

### Migration Errors

```bash
# Reset database (DANGER: This deletes all data)
dropdb collaboration_platform
createdb collaboration_platform
bun run db:migrate
```

## Next Steps

1. Create your first workspace
2. Invite team members
3. Create projects
4. Add tasks
5. Subscribe to real-time updates

## Support

For issues or questions, please open an issue on the repository.



