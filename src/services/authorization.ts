import { query } from '../db/connection.js';
import type { Request, Response } from 'express';

export type WorkspaceRole = 'Owner' | 'Member' | 'Viewer';
export type ProjectRole = 'Project Lead' | 'Contributor' | 'Project Viewer';

export const checkWorkspaceAccess = async (
  userId: string,
  workspaceId: string,
  minimumRole: WorkspaceRole = 'Viewer',
): Promise<{ hasAccess: boolean; role?: WorkspaceRole }> => {
  const result = await query(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
    [workspaceId, userId],
  );

  if (result.rows.length === 0) {
    return { hasAccess: false };
  }

  const role = result.rows[0].role;
  const roleHierarchy = { Owner: 3, Member: 2, Viewer: 1 };
  const minimumLevel = roleHierarchy[minimumRole];
  const userLevel = roleHierarchy[role as WorkspaceRole];

  return { hasAccess: userLevel >= minimumLevel, role };
};

export const checkProjectAccess = async (
  userId: string,
  projectId: string,
  minimumRole: ProjectRole = 'Project Viewer',
): Promise<{ hasAccess: boolean; role?: ProjectRole }> => {
  const result = await query(
    `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [projectId, userId],
  );

  if (result.rows.length === 0) {
    return { hasAccess: false };
  }

  const role = result.rows[0].role;
  const roleHierarchy = { 'Project Lead': 3, Contributor: 2, 'Project Viewer': 1 };
  const minimumLevel = roleHierarchy[minimumRole];
  const userLevel = roleHierarchy[role as ProjectRole];

  return { hasAccess: userLevel >= minimumLevel, role };
};

export const checkWorkspaceOwnership = async (userId: string, workspaceId: string): Promise<boolean> => {
  const result = await query(
    `SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 AND role = 'Owner'`,
    [workspaceId, userId],
  );
  return result.rows.length > 0;
};

export const checkProjectLeadAccess = async (userId: string, projectId: string): Promise<boolean> => {
  const result = await query(
    `SELECT role FROM project_members WHERE project_id = $1 AND user_id = $2 AND role = 'Project Lead'`,
    [projectId, userId],
  );
  return result.rows.length > 0;
};

export const requireWorkspaceAccess = async (
  userId: string,
  workspaceId: string,
  minimumRole: WorkspaceRole = 'Viewer',
): Promise<void> => {
  const { hasAccess } = await checkWorkspaceAccess(userId, workspaceId, minimumRole);
  if (!hasAccess) {
    throw new Error(`Insufficient permissions: Requires ${minimumRole} role or higher`);
  }
};

export const requireProjectAccess = async (
  userId: string,
  projectId: string,
  minimumRole: ProjectRole = 'Project Viewer',
): Promise<void> => {
  const { hasAccess } = await checkProjectAccess(userId, projectId, minimumRole);
  if (!hasAccess) {
    throw new Error(`Insufficient permissions: Requires ${minimumRole} role or higher`);
  }
};

