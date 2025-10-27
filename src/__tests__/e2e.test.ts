import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { hashPassword, getUserByEmail, generateAccessToken } from '../utils/auth.js';
import { query, getPool, closePool } from '../db/connection.js';
import { checkWorkspaceAccess, checkProjectAccess } from '../services/authorization.js';

describe('End-to-End Tests', () => {
  let testUserId: string;
  let testWorkspaceId: string;
  let testProjectId: string;
  let testUser2Id: string;
  
  beforeAll(async () => {
    console.log('Setting up E2E test environment...');
    
    // Create test users
    const passwordHash = await hashPassword('testPassword123');
    
    // Test user 1
    const user1Result = await query(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id`,
      ['e2e-test1@example.com', passwordHash, 'E2E Test User 1']
    );
    testUserId = user1Result.rows[0].id;
    
    // Test user 2
    const user2Result = await query(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id`,
      ['e2e-test2@example.com', passwordHash, 'E2E Test User 2']
    );
    testUser2Id = user2Result.rows[0].id;
  });
  
  afterAll(async () => {
    // Cleanup test data
    if (testUserId) {
      await query(`DELETE FROM users WHERE id = $1`, [testUserId]);
    }
    if (testUser2Id) {
      await query(`DELETE FROM users WHERE id = $1`, [testUser2Id]);
    }
  });

  test('should complete authentication flow', async () => {
    // Test user lookup
    const user = await getUserByEmail('e2e-test1@example.com');
    expect(user).toBeTruthy();
    expect(user.email).toBe('e2e-test1@example.com');
    
    // Test token generation
    const token = generateAccessToken({
      userId: user.id,
      email: user.email,
      globalStatus: user.global_status
    });
    expect(token).toBeTruthy();
  });

  test('should handle workspace authorization correctly', async () => {
    // Create test workspace
    const workspaceResult = await query(
      `INSERT INTO workspaces (name, description, created_by) VALUES ($1, $2, $3) RETURNING id`,
      ['Test Workspace', 'E2E Test Workspace', testUserId]
    );
    testWorkspaceId = workspaceResult.rows[0].id;
    
    // Add creator as owner
    await query(
      `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'Owner')`,
      [testWorkspaceId, testUserId]
    );
    
    // Test owner access
    const ownerAccess = await checkWorkspaceAccess(testUserId, testWorkspaceId, 'Owner');
    expect(ownerAccess.hasAccess).toBe(true);
    expect(ownerAccess.role).toBe('Owner');
    
    // Test non-member access (should fail)
    const nonMemberAccess = await checkWorkspaceAccess(testUser2Id, testWorkspaceId, 'Viewer');
    expect(nonMemberAccess.hasAccess).toBe(false);
  });

  test('should handle project authorization correctly', async () => {
    // Create test project
    const projectResult = await query(
      `INSERT INTO projects (workspace_id, name, description, created_by) VALUES ($1, $2, $3, $4) RETURNING id`,
      [testWorkspaceId, 'Test Project', 'E2E Test Project', testUserId]
    );
    testProjectId = projectResult.rows[0].id;
    
    // Add creator as project lead
    await query(
      `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'Project Lead')`,
      [testProjectId, testUserId]
    );
    
    // Test project lead access
    const leadAccess = await checkProjectAccess(testUserId, testProjectId, 'Project Lead');
    expect(leadAccess.hasAccess).toBe(true);
    expect(leadAccess.role).toBe('Project Lead');
    
    // Test non-member access (should fail)
    const nonMemberAccess = await checkProjectAccess(testUser2Id, testProjectId, 'Project Viewer');
    expect(nonMemberAccess.hasAccess).toBe(false);
  });

  test('should reject unauthorized access', async () => {
    // Test that non-members cannot access protected resources
    const workspaceAccess = await checkWorkspaceAccess(testUser2Id, testWorkspaceId, 'Viewer');
    expect(workspaceAccess.hasAccess).toBe(false);
    
    const projectAccess = await checkProjectAccess(testUser2Id, testProjectId, 'Project Viewer');
    expect(projectAccess.hasAccess).toBe(false);
  });
});



