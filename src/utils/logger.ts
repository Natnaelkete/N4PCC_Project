import winston from 'winston';
import { query } from '../db/connection.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// File-based logger
const fileLogger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../audit.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
});

// Console logger for development
const consoleLogger = winston.createLogger({
  level: 'debug',
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      let log = `${timestamp} [${level}]: ${message}`;
      if (Object.keys(meta).length > 0) {
        log += ` ${JSON.stringify(meta)}`;
      }
      return log;
    }),
  ),
  transports: [new winston.transports.Console()],
});

export type LogLevel = 'info' | 'warn' | 'error' | 'security';

interface LogDetails {
  userId?: string;
  ipAddress?: string;
  action: string;
  details?: any;
}

// Dual logging: File + Database
export const log = async (level: LogLevel, message: string, details: LogDetails) => {
  const timestamp = new Date().toISOString();
  const logData = {
    level,
    message,
    timestamp,
    ...details,
  };

  // Log to file
  fileLogger.log(level, message, logData);

  // Log to console in development
  if (process.env.NODE_ENV !== 'production') {
    consoleLogger.log(level, message, logData);
  }

  // Log to database
  try {
    await query(
      `INSERT INTO audit_logs (timestamp, level, user_id, ip_address, action, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [timestamp, level, details.userId || null, details.ipAddress || null, details.action, JSON.stringify(details.details || {})],
    );
  } catch (error) {
    console.error('Failed to write to audit log database:', error);
  }
};

export const logger = {
  info: (message: string, details: LogDetails) => log('info', message, details),
  warn: (message: string, details: LogDetails) => log('warn', message, details),
  error: (message: string, details: LogDetails) => log('error', message, details),
  security: (message: string, details: LogDetails) => log('security', message, details),
};



