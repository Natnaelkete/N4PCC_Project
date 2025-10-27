import express, { Request, Response } from 'express';
import { query } from '../db/connection.js';
import { comparePassword, generateAccessToken, generateRefreshToken, saveDevice, revokeDevice, getUserByEmail, generateDeviceId } from '../utils/auth.js';
import { logger } from '../utils/logger.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await getUserByEmail(email);
    if (!user) {
      logger.security('Login attempt failed', {
        ipAddress: req.ip,
        action: 'LOGIN_FAILURE',
        details: { email, reason: 'User not found' },
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.global_status === 'BANNED') {
      logger.security('Login attempt by banned user', {
        userId: user.id,
        ipAddress: req.ip,
        action: 'LOGIN_FAILURE_BANNED',
      });
      return res.status(403).json({ error: 'Account is banned' });
    }

    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      logger.security('Login attempt failed', {
        ipAddress: req.ip,
        action: 'LOGIN_FAILURE',
        details: { email, reason: 'Invalid password' },
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const deviceId = generateDeviceId();
    await saveDevice(user.id, deviceId, req.ip, req.headers['user-agent']);

    const payload = {
      userId: user.id,
      email: user.email,
      globalStatus: user.global_status,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    logger.info('User logged in', {
      userId: user.id,
      ipAddress: req.ip,
      action: 'LOGIN_SUCCESS',
    });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        global_status: user.global_status,
      },
    });
  } catch (error) {
    logger.error('Login error', {
      ipAddress: req.ip,
      action: 'LOGIN_ERROR',
      details: { error: (error as Error).message },
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/logout', authenticate, async (req: any, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.headers['x-refresh-token'];
    if (refreshToken) {
      // In a real implementation, you'd verify the token to get deviceId
      // For now, we'll use a placeholder
      const deviceId = req.headers['x-device-id'] || 'unknown';
      await revokeDevice(req.userId, deviceId);
    }

    res.clearCookie('refreshToken');

    logger.info('User logged out', {
      userId: req.userId,
      ipAddress: req.ip,
      action: 'LOGOUT_SUCCESS',
    });

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error', {
      userId: req.userId,
      ipAddress: req.ip,
      action: 'LOGOUT_ERROR',
      details: { error: (error as Error).message },
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies.refreshToken || req.headers['x-refresh-token'];
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    const jwt = await import('jsonwebtoken');
    const config = (await import('../config/index.js')).default;
    const payload = jwt.verify(refreshToken, config.jwt.refreshSecret) as any;

    const user = await getUserByEmail(payload.email);
    if (!user || user.global_status === 'BANNED') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const newPayload = {
      userId: user.id,
      email: user.email,
      globalStatus: user.global_status,
    };

    const newAccessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    logger.info('Token refreshed', {
      userId: user.id,
      ipAddress: req.ip,
      action: 'TOKEN_REFRESHED',
    });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    logger.error('Token refresh failed', {
      ipAddress: req.ip,
      action: 'TOKEN_REFRESH_FAILURE',
      details: { error: (error as Error).message },
    });
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

export default router;



