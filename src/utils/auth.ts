import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import config from '../config/index.js';
import { query } from '../db/connection.js';
import { randomUUID } from 'crypto';

export interface JWTPayload {
  userId: string;
  email: string;
  globalStatus: string;
}

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  return await bcrypt.compare(password, hash);
};

export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
};

export const generateRefreshToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
};

export const verifyAccessToken = (token: string): JWTPayload => {
  return jwt.verify(token, config.jwt.secret) as JWTPayload;
};

export const verifyRefreshToken = (token: string): JWTPayload => {
  return jwt.verify(token, config.jwt.refreshSecret) as JWTPayload;
};

export const generateDeviceId = (): string => {
  return randomUUID();
};

export const saveDevice = async (
  userId: string,
  deviceId: string,
  ipAddress: string | undefined,
  userAgent: string | undefined,
): Promise<void> => {
  await query(
    `INSERT INTO user_devices (user_id, device_id, ip_address, user_agent)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, device_id) DO UPDATE
     SET login_time = NOW(), is_revoked = FALSE, revoked_at = NULL, ip_address = $3, user_agent = $4`,
    [userId, deviceId, ipAddress, userAgent],
  );
};

export const revokeDevice = async (userId: string, deviceId: string): Promise<void> => {
  await query(
    `UPDATE user_devices 
     SET is_revoked = TRUE, revoked_at = NOW()
     WHERE user_id = $1 AND device_id = $2`,
    [userId, deviceId],
  );
};

export const isDeviceRevoked = async (userId: string, deviceId: string): Promise<boolean> => {
  const result = await query(
    `SELECT is_revoked FROM user_devices WHERE user_id = $1 AND device_id = $2`,
    [userId, deviceId],
  );
  return result.rows[0]?.is_revoked || true;
};

export const generateResetToken = (): string => {
  return randomUUID();
};

export const getUserByEmail = async (email: string) => {
  const result = await query(`SELECT * FROM users WHERE email = $1`, [email]);
  return result.rows[0];
};

export const getUserById = async (id: string) => {
  const result = await query(`SELECT * FROM users WHERE id = $1`, [id]);
  return result.rows[0];
};

