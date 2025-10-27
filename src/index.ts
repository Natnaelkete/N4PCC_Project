import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { typeDefs } from './graphql/schema.js';
import { resolvers } from './graphql/resolvers.js';
import { getPool, closePool } from './db/connection.js';
import authRoutes from './routes/auth.js';
import cookieParser from 'cookie-parser';
import { logger } from './utils/logger.js';
import config from './config/index.js';
import rateLimit from 'express-rate-limit';
import { authenticate } from './middleware/auth.js';

const app = express();
const PORT = config.port;

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);

// Rate limiting for public endpoints
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes with rate limiting
app.use('/api/auth', authLimiter, authRoutes);

// GraphQL Context Function
const getContext = async ({ req }: { req: any }) => {
  let userId: string | undefined;
  let user: any | undefined;

  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const jwt = await import('jsonwebtoken');
      const config = (await import('./config/index.js')).default;
      const payload = jwt.verify(token, config.jwt.secret) as any;
      userId = payload.userId;
      const { getUserById } = await import('./utils/auth.js');
      user = await getUserById(payload.userId);
    }
  } catch (error) {
    // Token validation failed, continue without user
  }

  return {
    userId,
    user,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
};

// Setup Apollo Server
const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  csrfPrevention: true,
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received, starting graceful shutdown...`);
  
  logger.info('Server shutdown initiated', {
    action: 'SERVER_SHUTDOWN',
    details: { signal },
  });

  // Stop accepting new connections
  server.close(async () => {
    console.log('HTTP server closed');

    // Close database connections
    await closePool();
    console.log('Database connections closed');

    // Close Apollo Server
    await apolloServer.stop();
    console.log('Apollo Server stopped');

    process.exit(0);
  });

  // Force shutdown after timeout
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const pool = getPool();
    await pool.query('SELECT NOW()');
    console.log('Database connected successfully');

    // Start Apollo Server
    await apolloServer.start();

    // Apply Apollo middleware
    app.use(
      '/graphql',
      express.json(),
      expressMiddleware(apolloServer, {
        context: getContext,
      }),
    );

    // Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 GraphQL endpoint: http://localhost:${PORT}/graphql`);
      console.log(`🔒 Auth endpoint: http://localhost:${PORT}/api/auth`);
      console.log(`📝 Health check: http://localhost:${PORT}/health`);
      console.log(`\nEnvironment: ${config.nodeEnv}`);
      
      logger.info('Server started', {
        action: 'SERVER_STARTED',
        details: { port: PORT },
      });
    });

    // Setup graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle unhandled errors
    process.on('unhandledRejection', (error) => {
      logger.error('Unhandled promise rejection', {
        action: 'UNHANDLED_REJECTION',
        details: { error: (error as Error).message },
      });
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', {
        action: 'UNCAUGHT_EXCEPTION',
        details: { error: error.message },
      });
      gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    return server;
  } catch (error) {
    logger.error('Failed to start server', {
      action: 'SERVER_START_FAILED',
      details: { error: (error as Error).message },
    });
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

let server: any;
startServer().then((s) => {
  server = s;
});

export default app;



