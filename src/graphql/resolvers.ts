import { GraphQLError } from 'graphql';
import { query } from '../db/connection.js';
import {
  hashPassword,
  comparePassword,
  getUserByEmail,
  getUserById,
  saveDevice,
  revokeDevice,
} from '../utils/auth.js';
import { logger } from '../utils/logger.js';
import {
  checkWorkspaceAccess,
  checkProjectAccess,
  checkWorkspaceOwnership,
  checkProjectLeadAccess,
  requireWorkspaceAccess,
  requireProjectAccess,
  WorkspaceRole,
  ProjectRole,
} from '../services/authorization.js';
import { createNotification, markNotificationAsSeen, getNotifications, getUnseenNotifications } from '../services/notifications.js';
import { PubSub } from 'graphql-subscriptions';
import { GoogleGenerativeAI } from '@google/generative-ai';
import config from '../config/index.js';
import { randomUUID } from 'crypto';

const pubsub = new PubSub();
const aiClient = config.gemini.apiKey ? new GoogleGenerativeAI(config.gemini.apiKey) : null;

interface Context {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export const resolvers = {
  Query: {
    me: async (_: any, __: any, context: Context) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      const user = await getUserById(context.userId);
      return user;
    },

    getUser: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      const user = await getUserById(id);
      return user;
    },

    getAllWorkspaces: async (_: any, __: any, context: Context) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      const user = await getUserById(context.userId);
      if (user.global_status !== 'ADMIN') {
        throw new GraphQLError('Forbidden: Admin access required');
      }

      const result = await query(`
        SELECT w.*, 
               json_agg(
                 json_build_object(
                   'id', wm.id,
                   'user', json_build_object('id', u.id, 'email', u.email, 'full_name', u.full_name),
                   'role', wm.role,
                   'joined_at', wm.joined_at
                 )
               ) as members
        FROM workspaces w
        LEFT JOIN workspace_members wm ON w.id = wm.workspace_id
        LEFT JOIN users u ON wm.user_id = u.id
        GROUP BY w.id
      `);
      return result.rows;
    },

    getWorkspace: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      await requireWorkspaceAccess(context.userId, id, 'Viewer');

      const result = await query(
        `SELECT * FROM workspaces WHERE id = $1`,
        [id],
      );
      const workspace = result.rows[0];

      const membersResult = await query(
        `SELECT wm.*, u.email, u.full_name 
         FROM workspace_members wm
         JOIN users u ON wm.user_id = u.id
         WHERE wm.workspace_id = $1`,
        [id],
      );
      workspace.members = membersResult.rows.map((row) => ({
        id: row.id,
        user: { id: row.user_id, email: row.email, full_name: row.full_name },
        role: row.role,
        joined_at: row.joined_at,
      }));

      return workspace;
    },

    getProject: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      await requireProjectAccess(context.userId, id, 'Project Viewer');

      const result = await query(`SELECT * FROM projects WHERE id = $1`, [id]);
      const project = result.rows[0];

      const membersResult = await query(
        `SELECT pm.*, u.email, u.full_name
         FROM project_members pm
         JOIN users u ON pm.user_id = u.id
         WHERE pm.project_id = $1`,
        [id],
      );
      project.members = membersResult.rows.map((row) => ({
        id: row.id,
        user: { id: row.user_id, email: row.email, full_name: row.full_name },
        role: row.role,
        joined_at: row.joined_at,
      }));

      const tasksResult = await query(`SELECT * FROM tasks WHERE project_id = $1`, [id]);
      project.tasks = tasksResult.rows;

      return project;
    },

    getTask: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      const result = await query(`SELECT * FROM tasks WHERE id = $1`, [id]);
      if (!result.rows[0]) throw new GraphQLError('Task not found');

      const task = result.rows[0];
      const { hasAccess } = await checkProjectAccess(context.userId, task.project_id, 'Project Viewer');
      if (!hasAccess) throw new GraphQLError('Forbidden');

      const assignmentsResult = await query(
        `SELECT ta.*, u.email, u.full_name
         FROM task_assignments ta
         JOIN users u ON ta.user_id = u.id
         WHERE ta.task_id = $1`,
        [id],
      );
      task.assigned_to = assignmentsResult.rows.map((row) => ({
        id: row.id,
        user: { id: row.user_id, email: row.email, full_name: row.full_name },
        assigned_at: row.assigned_at,
      }));

      return task;
    },

    getNotifications: async (_: any, { limit }: { limit?: number }, context: Context) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      return await getNotifications(context.userId, limit);
    },

    getUnseenNotifications: async (_: any, __: any, context: Context) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      return await getUnseenNotifications(context.userId);
    },
  },

  Mutation: {
    // Authentication Mutations
    register: async (
      _: any,
      { email, password, full_name }: { email: string; password: string; full_name: string },
      context: Context,
    ) => {
      const existingUser = await getUserByEmail(email);
      if (existingUser) {
        throw new GraphQLError('User with this email already exists');
      }

      const passwordHash = await hashPassword(password);
      const result = await query(
        `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING *`,
        [email, passwordHash, full_name],
      );
      const user = result.rows[0];

      logger.info('User registered', {
        userId: user.id,
        ipAddress: context.ipAddress,
        action: 'USER_REGISTERED',
      });

      // Note: In a real implementation, you'd generate tokens here
      // For now, returning mock tokens
      return {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        user,
      };
    },

    forgotPassword: async (_: any, { email }: { email: string }) => {
      const user = await getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists
        return true;
      }

      // In production, send email with reset link
      const resetToken = 'reset-token-123';
      logger.info('Password reset requested', {
        userId: user.id,
        action: 'PASSWORD_RESET_REQUESTED',
      });

      return true;
    },

    updatePassword: async (
      _: any,
      { oldPassword, newPassword }: { oldPassword: string; newPassword: string },
      context: Context,
    ) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');

      const user = await getUserById(context.userId);
      const isValid = await comparePassword(oldPassword, user.password_hash);
      if (!isValid) {
        throw new GraphQLError('Invalid old password');
      }

      const newPasswordHash = await hashPassword(newPassword);
      await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newPasswordHash, context.userId]);

      logger.info('Password updated', {
        userId: context.userId,
        ipAddress: context.ipAddress,
        action: 'PASSWORD_UPDATED',
      });

      return true;
    },

    // Admin Mutations
    banUser: async (_: any, { userId }: { userId: string }, context: Context) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      const adminUser = await getUserById(context.userId);
      if (adminUser.global_status !== 'ADMIN') {
        throw new GraphQLError('Forbidden: Admin access required');
      }

      await query(`UPDATE users SET global_status = 'BANNED' WHERE id = $1`, [userId]);

      logger.security('User banned', {
        userId: context.userId,
        ipAddress: context.ipAddress,
        action: 'USER_BANNED',
        details: { targetUserId: userId },
      });

      return true;
    },

    unbanUser: async (_: any, { userId }: { userId: string }, context: Context) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      const adminUser = await getUserById(context.userId);
      if (adminUser.global_status !== 'ADMIN') {
        throw new GraphQLError('Forbidden: Admin access required');
      }

      await query(`UPDATE users SET global_status = 'ACTIVE' WHERE id = $1`, [userId]);

      logger.security('User unbanned', {
        userId: context.userId,
        ipAddress: context.ipAddress,
        action: 'USER_UNBANNED',
        details: { targetUserId: userId },
      });

      return true;
    },

    adminResetPassword: async (
      _: any,
      { userId, newPassword }: { userId: string; newPassword: string },
      context: Context,
    ) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      const adminUser = await getUserById(context.userId);
      if (adminUser.global_status !== 'ADMIN') {
        throw new GraphQLError('Forbidden: Admin access required');
      }

      const newPasswordHash = await hashPassword(newPassword);
      await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [newPasswordHash, userId]);

      logger.security('Admin reset password', {
        userId: context.userId,
        ipAddress: context.ipAddress,
        action: 'ADMIN_RESET_PASSWORD',
        details: { targetUserId: userId },
      });

      return true;
    },

    // Workspace Mutations
    createWorkspace: async (_: any, { name, description }: { name: string; description?: string }, context: Context) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');

      const result = await query(
        `INSERT INTO workspaces (name, description, created_by) VALUES ($1, $2, $3) RETURNING *`,
        [name, description, context.userId],
      );
      const workspace = result.rows[0];

      await query(
        `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'Owner')`,
        [workspace.id, context.userId],
      );

      logger.info('Workspace created', {
        userId: context.userId,
        ipAddress: context.ipAddress,
        action: 'WORKSPACE_CREATED',
        details: { workspaceId: workspace.id },
      });

      workspace.members = [];
      return workspace;
    },

    addWorkspaceMember: async (
      _: any,
      { workspaceId, userId }: { workspaceId: string; userId: string },
      context: Context,
    ) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      const isOwner = await checkWorkspaceOwnership(context.userId, workspaceId);
      if (!isOwner) {
        throw new GraphQLError('Forbidden: Owner access required');
      }

      await query(
        `INSERT INTO workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, 'Member')
         ON CONFLICT DO NOTHING`,
        [workspaceId, userId],
      );

      logger.info('Workspace member added', {
        userId: context.userId,
        ipAddress: context.ipAddress,
        action: 'WORKSPACE_MEMBER_ADDED',
        details: { workspaceId, addedUserId: userId },
      });

      return true;
    },

    removeWorkspaceMember: async (
      _: any,
      { workspaceId, userId }: { workspaceId: string; userId: string },
      context: Context,
    ) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      const isOwner = await checkWorkspaceOwnership(context.userId, workspaceId);
      if (!isOwner) {
        throw new GraphQLError('Forbidden: Owner access required');
      }

      await query(`DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, userId]);

      logger.info('Workspace member removed', {
        userId: context.userId,
        ipAddress: context.ipAddress,
        action: 'WORKSPACE_MEMBER_REMOVED',
        details: { workspaceId, removedUserId: userId },
      });

      return true;
    },

    updateWorkspaceMemberRole: async (
      _: any,
      { workspaceId, userId, role }: { workspaceId: string; userId: string; role: string },
      context: Context,
    ) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      const isOwner = await checkWorkspaceOwnership(context.userId, workspaceId);
      if (!isOwner) {
        throw new GraphQLError('Forbidden: Owner access required');
      }

      await query(`UPDATE workspace_members SET role = $1 WHERE workspace_id = $2 AND user_id = $3`, [
        role,
        workspaceId,
        userId,
      ]);

      logger.info('Workspace member role updated', {
        userId: context.userId,
        ipAddress: context.ipAddress,
        action: 'WORKSPACE_MEMBER_ROLE_UPDATED',
        details: { workspaceId, updatedUserId: userId, newRole: role },
      });

      return true;
    },

    // Project Mutations
    createProject: async (
      _: any,
      { workspaceId, name, description }: { workspaceId: string; name: string; description?: string },
      context: Context,
    ) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      await requireWorkspaceAccess(context.userId, workspaceId, 'Member');

      const result = await query(
        `INSERT INTO projects (workspace_id, name, description, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
        [workspaceId, name, description, context.userId],
      );
      const project = result.rows[0];

      await query(
        `INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'Project Lead')`,
        [project.id, context.userId],
      );

      logger.info('Project created', {
        userId: context.userId,
        ipAddress: context.ipAddress,
        action: 'PROJECT_CREATED',
        details: { projectId: project.id, workspaceId },
      });

      project.members = [];
      project.tasks = [];
      return project;
    },

    updateProject: async (
      _: any,
      { id, name, description }: { id: string; name?: string; description?: string },
      context: Context,
    ) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      const isLead = await checkProjectLeadAccess(context.userId, id);
      if (!isLead) {
        throw new GraphQLError('Forbidden: Project Lead access required');
      }

      const updates = [];
      const params: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        params.push(name);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        params.push(description);
      }

      if (updates.length === 0) {
        const result = await query(`SELECT * FROM projects WHERE id = $1`, [id]);
        return result.rows[0];
      }

      params.push(id);
      const result = await query(
        `UPDATE projects SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        params,
      );

      return result.rows[0];
    },

    deleteProject: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      const isLead = await checkProjectLeadAccess(context.userId, id);
      if (!isLead) {
        throw new GraphQLError('Forbidden: Project Lead access required');
      }

      await query(`DELETE FROM projects WHERE id = $1`, [id]);

      logger.info('Project deleted', {
        userId: context.userId,
        ipAddress: context.ipAddress,
        action: 'PROJECT_DELETED',
        details: { projectId: id },
      });

      return true;
    },

    addProjectMember: async (
      _: any,
      { projectId, userId }: { projectId: string; userId: string },
      context: Context,
    ) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      const isLead = await checkProjectLeadAccess(context.userId, projectId);
      if (!isLead) {
        // Check if user is workspace owner
        const projectResult = await query(`SELECT workspace_id FROM projects WHERE id = $1`, [projectId]);
        const workspaceId = projectResult.rows[0]?.workspace_id;
        if (!workspaceId) throw new GraphQLError('Project not found');
        
        const isWorkspaceOwner = await checkWorkspaceOwnership(context.userId, workspaceId);
        if (!isWorkspaceOwner) {
          throw new GraphQLError('Forbidden: Project Lead or Workspace Owner access required');
        }
      }

      // Ensure user is a workspace member first
      const projectResult = await query(`SELECT workspace_id FROM projects WHERE id = $1`, [projectId]);
      const workspaceId = projectResult.rows[0]?.workspace_id;
      const { hasAccess } = await checkWorkspaceAccess(userId, workspaceId, 'Viewer');
      if (!hasAccess) {
        throw new GraphQLError('User must be a workspace member first');
      }

      await query(
        `INSERT INTO project_members (project_id, user_id, role)
         VALUES ($1, $2, 'Contributor')
         ON CONFLICT DO NOTHING`,
        [projectId, userId],
      );

      logger.info('Project member added', {
        userId: context.userId,
        ipAddress: context.ipAddress,
        action: 'PROJECT_MEMBER_ADDED',
        details: { projectId, addedUserId: userId },
      });

      return true;
    },

    removeProjectMember: async (
      _: any,
      { projectId, userId }: { projectId: string; userId: string },
      context: Context,
    ) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      const isLead = await checkProjectLeadAccess(context.userId, projectId);
      if (!isLead) {
        const projectResult = await query(`SELECT workspace_id FROM projects WHERE id = $1`, [projectId]);
        const workspaceId = projectResult.rows[0]?.workspace_id;
        if (!workspaceId) throw new GraphQLError('Project not found');
        
        const isWorkspaceOwner = await checkWorkspaceOwnership(context.userId, workspaceId);
        if (!isWorkspaceOwner) {
          throw new GraphQLError('Forbidden: Project Lead or Workspace Owner access required');
        }
      }

      await query(`DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`, [projectId, userId]);

      logger.info('Project member removed', {
        userId: context.userId,
        ipAddress: context.ipAddress,
        action: 'PROJECT_MEMBER_REMOVED',
        details: { projectId, removedUserId: userId },
      });

      return true;
    },

    updateProjectMemberRole: async (
      _: any,
      { projectId, userId, role }: { projectId: string; userId: string; role: string },
      context: Context,
    ) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      const isLead = await checkProjectLeadAccess(context.userId, projectId);
      if (!isLead) {
        const isWorkspaceOwner = await checkWorkspaceOwnership(context.userId, projectId);
        if (!isWorkspaceOwner) {
          throw new GraphQLError('Forbidden: Project Lead or Workspace Owner access required');
        }
      }

      await query(`UPDATE project_members SET role = $1 WHERE project_id = $2 AND user_id = $3`, [
        role,
        projectId,
        userId,
      ]);

      logger.info('Project member role updated', {
        userId: context.userId,
        ipAddress: context.ipAddress,
        action: 'PROJECT_MEMBER_ROLE_UPDATED',
        details: { projectId, updatedUserId: userId, newRole: role },
      });

      return true;
    },

    // Task Mutations
    createTask: async (
      _: any,
      {
        projectId,
        title,
        description,
        assignedToIds,
      }: { projectId: string; title: string; description?: string; assignedToIds?: string[] },
      context: Context,
    ) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      await requireProjectAccess(context.userId, projectId, 'Contributor');

      const result = await query(
        `INSERT INTO tasks (project_id, title, description, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
        [projectId, title, description, context.userId],
      );
      const task = result.rows[0];

      if (assignedToIds && assignedToIds.length > 0) {
        for (const userId of assignedToIds) {
          await query(
            `INSERT INTO task_assignments (task_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [task.id, userId],
          );
          await createNotification(
            userId,
            'Task Assigned',
            `You have been assigned to task: ${title}`,
            task.id,
            'Task',
          );
        }
      }

      logger.info('Task created', {
        userId: context.userId,
        ipAddress: context.ipAddress,
        action: 'TASK_CREATED',
        details: { taskId: task.id, projectId },
      });

      task.assigned_to = [];
      return task;
    },

    updateTask: async (
      _: any,
      {
        id,
        title,
        description,
        status,
        assignedToIds,
      }: { id: string; title?: string; description?: string; status?: string; assignedToIds?: string[] },
      context: Context,
    ) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      const existingTask = (await query(`SELECT * FROM tasks WHERE id = $1`, [id])).rows[0];
      if (!existingTask) throw new GraphQLError('Task not found');

      await requireProjectAccess(context.userId, existingTask.project_id, 'Contributor');

      const updates = [];
      const params: any[] = [];
      let paramCount = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramCount++}`);
        params.push(title);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        params.push(description);
      }
      if (status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        params.push(status);
      }

      if (updates.length === 0 && !assignedToIds) {
        const result = await query(`SELECT * FROM tasks WHERE id = $1`, [id]);
        return result.rows[0];
      }

      let oldStatus = existingTask.status;
      let oldAssignedToIds: string[] = [];
      if (assignedToIds || status) {
        const assignedResult = await query(`SELECT user_id FROM task_assignments WHERE task_id = $1`, [id]);
        oldAssignedToIds = assignedResult.rows.map((r) => r.user_id);
      }

      if (updates.length > 0) {
        params.push(id);
        await query(`UPDATE tasks SET ${updates.join(', ')} WHERE id = $${paramCount}`, params);
      }

      if (assignedToIds) {
        // Remove old assignments
        await query(`DELETE FROM task_assignments WHERE task_id = $1`, [id]);

        // Add new assignments and create notifications for newly assigned users
        for (const userId of assignedToIds) {
          await query(`INSERT INTO task_assignments (task_id, user_id) VALUES ($1, $2)`, [id, userId]);
          if (!oldAssignedToIds.includes(userId)) {
            await createNotification(userId, 'Task Assigned', `You have been assigned to task: ${title || existingTask.title}`, id, 'Task');
          }
        }
      }

      const result = await query(`SELECT * FROM tasks WHERE id = $1`, [id]);
      const task = result.rows[0];

      // Trigger subscription for status change
      if (status && status !== oldStatus) {
        const workspaceResult = await query(
          `SELECT workspace_id FROM projects WHERE id = $1`,
          [task.project_id],
        );
        const workspaceId = workspaceResult.rows[0].workspace_id;

        pubsub.publish(`TASK_STATUS_UPDATED_${workspaceId}`, {
          taskStatusUpdated: task,
        });

        logger.info('Task status updated', {
          userId: context.userId,
          ipAddress: context.ipAddress,
          action: 'TASK_STATUS_UPDATED',
          details: { taskId: task.id, oldStatus, newStatus: status },
        });
      }

      return task;
    },

    deleteTask: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      const existingTask = (await query(`SELECT * FROM tasks WHERE id = $1`, [id])).rows[0];
      if (!existingTask) throw new GraphQLError('Task not found');

      await requireProjectAccess(context.userId, existingTask.project_id, 'Contributor');

      await query(`DELETE FROM tasks WHERE id = $1`, [id]);

      logger.info('Task deleted', {
        userId: context.userId,
        ipAddress: context.ipAddress,
        action: 'TASK_DELETED',
        details: { taskId: id },
      });

      return true;
    },

    // Notification Mutations
    markNotificationAsSeen: async (_: any, { notificationId }: { notificationId: string }, context: Context) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      await markNotificationAsSeen(context.userId, notificationId);
      return true;
    },

    // AI Mutations (Bonus)
    summarizeTask: async (_: any, { taskDescription }: { taskDescription: string }) => {
      if (!aiClient) {
        throw new GraphQLError('AI service not configured');
      }

      try {
        const model = aiClient.getGenerativeModel({ model: 'gemini-pro' });
        const prompt = `Summarize this task description in 1-2 sentences: ${taskDescription}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
      } catch (error) {
        throw new GraphQLError('Failed to generate summary');
      }
    },

    generateTasksFromPrompt: async (_: any, { prompt, projectId }: { prompt: string; projectId: string }, context: Context) => {
      if (!context.userId) throw new GraphQLError('Unauthorized');
      if (!aiClient) {
        throw new GraphQLError('AI service not configured');
      }

      await requireProjectAccess(context.userId, projectId, 'Contributor');

      try {
        const model = aiClient.getGenerativeModel({ model: 'gemini-pro' });
        const aiPrompt = `Generate a structured list of tasks for this project: ${prompt}. Return only a JSON array of objects with 'title' and 'description' fields.`;
        const result = await model.generateContent(aiPrompt);
        const response = await result.response;
        const tasksData = JSON.parse(response.text());

        const createdTasks = [];
        for (const taskData of tasksData) {
          const result = await query(
            `INSERT INTO tasks (project_id, title, description, created_by) VALUES ($1, $2, $3, $4) RETURNING *`,
            [projectId, taskData.title, taskData.description, context.userId],
          );
          createdTasks.push(result.rows[0]);
        }

        logger.info('AI tasks generated', {
          userId: context.userId,
          ipAddress: context.ipAddress,
          action: 'AI_TASKS_GENERATED',
          details: { projectId, taskCount: createdTasks.length },
        });

        return createdTasks;
      } catch (error) {
        throw new GraphQLError('Failed to generate tasks');
      }
    },
  },

  Subscription: {
    taskStatusUpdated: {
      subscribe: async (_: any, { workspaceId }: { workspaceId: string }, context: Context) => {
        if (!context.userId) throw new GraphQLError('Unauthorized');
        await requireWorkspaceAccess(context.userId, workspaceId, 'Viewer');
        return pubsub.asyncIterator([`TASK_STATUS_UPDATED_${workspaceId}`]);
      },
    },
  },
};

