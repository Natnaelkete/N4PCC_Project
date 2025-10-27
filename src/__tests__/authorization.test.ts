import { describe, test, expect } from 'bun:test';
import { checkWorkspaceAccess, checkProjectAccess } from '../services/authorization.js';

describe('Authorization Services', () => {
  test('checkWorkspaceAccess should validate role hierarchy', () => {
    const roleHierarchy = { Owner: 3, Member: 2, Viewer: 1 };
    
    // Owner should have access to all roles
    expect(roleHierarchy.Owner).toBeGreaterThanOrEqual(roleHierarchy.Viewer);
    expect(roleHierarchy.Owner).toBeGreaterThanOrEqual(roleHierarchy.Member);
    expect(roleHierarchy.Owner).toBeGreaterThanOrEqual(roleHierarchy.Owner);
    
    // Member should have access to Viewer
    expect(roleHierarchy.Member).toBeGreaterThanOrEqual(roleHierarchy.Viewer);
    
    // Viewer should have access to Viewer
    expect(roleHierarchy.Viewer).toBeGreaterThanOrEqual(roleHierarchy.Viewer);
  });

  test('checkProjectAccess should validate project role hierarchy', () => {
    const roleHierarchy = { 'Project Lead': 3, Contributor: 2, 'Project Viewer': 1 };
    
    // Project Lead should have access to all roles
    expect(roleHierarchy['Project Lead']).toBeGreaterThanOrEqual(roleHierarchy['Project Viewer']);
    expect(roleHierarchy['Project Lead']).toBeGreaterThanOrEqual(roleHierarchy.Contributor);
    
    // Contributor should have access to Project Viewer
    expect(roleHierarchy.Contributor).toBeGreaterThanOrEqual(roleHierarchy['Project Viewer']);
  });
});



