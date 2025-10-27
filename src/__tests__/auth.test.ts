import { describe, test, expect, beforeAll } from 'bun:test';
import { hashPassword, comparePassword, generateAccessToken, verifyAccessToken } from '../utils/auth.js';

describe('Authentication Utilities', () => {
  test('should hash and compare passwords correctly', async () => {
    const password = 'testPassword123';
    const hash = await hashPassword(password);
    
    expect(hash).toBeTruthy();
    expect(hash).not.toBe(password);
    
    const isValid = await comparePassword(password, hash);
    expect(isValid).toBe(true);
    
    const isInvalid = await comparePassword('wrongPassword', hash);
    expect(isInvalid).toBe(false);
  });

  test('should generate and verify JWT tokens', () => {
    const payload = {
      userId: 'test-user-id',
      email: 'test@example.com',
      globalStatus: 'ACTIVE',
    };

    const token = generateAccessToken(payload);
    expect(token).toBeTruthy();

    const decoded = verifyAccessToken(token);
    expect(decoded.userId).toBe(payload.userId);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.globalStatus).toBe(payload.globalStatus);
  });

  test('should reject invalid tokens', () => {
    expect(() => {
      verifyAccessToken('invalid.token.here');
    }).toThrow();
  });
});



