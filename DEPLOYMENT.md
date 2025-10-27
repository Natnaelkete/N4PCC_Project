# Deployment Guide

This guide covers deploying the N4PCC Collaboration Platform to production.

## Quick Start with Docker

The easiest way to deploy is using Docker Compose:

```bash
docker-compose up -d
```

This will start both the PostgreSQL database and the application server.

## Manual Deployment

### Prerequisites

- Bun 1.0 or higher
- PostgreSQL 16 or higher
- Node.js 20+ (if not using Bun)

### Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd n4pcc-project
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with production settings
   ```

4. **Set up the database**
   ```bash
   bun run db:migrate
   bun run db:seed  # Optional: for test data
   ```

5. **Start the server**
   ```bash
   bun run start
   ```

## Production Checklist

- [ ] Change all default JWT secrets
- [ ] Use a strong `DATABASE_URL`
- [ ] Set `NODE_ENV=production`
- [ ] Configure proper CORS origins
- [ ] Set up SSL/TLS certificates
- [ ] Configure log rotation
- [ ] Set up monitoring and alerts
- [ ] Configure backup strategy for database

## Environment Variables

### Required

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret for access token signing
- `JWT_REFRESH_SECRET` - Secret for refresh token signing

### Optional

- `PORT` - Server port (default: 4000)
- `NODE_ENV` - Environment mode
- `GEMINI_API_KEY` - For AI features
- `RATE_LIMIT_WINDOW_MS` - Rate limiting window
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window

## Docker Deployment

### Build the image

```bash
docker build -t n4pcc-collaboration-platform .
```

### Run the container

```bash
docker run -d \
  -p 4000:4000 \
  -e DATABASE_URL=postgresql://user:password@localhost:5432/collaboration_platform \
  -e JWT_SECRET=your-secret-key \
  -e JWT_REFRESH_SECRET=your-refresh-secret-key \
  n4pcc-collaboration-platform
```

## Health Checks

The application includes a health check endpoint:

```bash
curl http://localhost:4000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Graceful Shutdown

The application handles SIGTERM and SIGINT signals gracefully:

- Stops accepting new connections
- Closes database connections
- Stops Apollo Server
- Logs shutdown events

This is important for zero-downtime deployments.

## Monitoring

### Log Files

- Application logs: `audit.log`
- Database audit logs: `audit_logs` table

### Key Metrics to Monitor

- Request rate
- Error rate
- Database connection pool usage
- Memory usage
- Disk space (for logs)

## Backup Strategy

### Database Backups

Use PostgreSQL's native backup tools:

```bash
# Full backup
pg_dump -U user collaboration_platform > backup.sql

# Restore
psql -U user collaboration_platform < backup.sql
```

### Log Rotation

Configure log rotation for `audit.log`:

```
/path/to/audit.log {
    daily
    rotate 7
    compress
    missingok
    notifempty
}
```

## Troubleshooting

### Database Connection Issues

```bash
# Check database status
docker-compose ps

# View database logs
docker-compose logs postgres

# Test connection
psql $DATABASE_URL -c "SELECT NOW();"
```

### High Memory Usage

- Adjust database connection pool size
- Implement log rotation
- Review query performance

### Rate Limiting

If experiencing issues with rate limiting, adjust in `.env`:

```
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
```

## Support

For deployment issues, please open an issue on the repository.



