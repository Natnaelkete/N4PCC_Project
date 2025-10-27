import { gql } from 'graphql-tag';

export const typeDefs = gql`
  scalar DateTime

  type User {
    id: ID!
    email: String!
    full_name: String!
    global_status: String!
    created_at: DateTime!
    updated_at: DateTime!
  }

  type WorkspaceMember {
    id: ID!
    user: User!
    role: String!
    joined_at: DateTime!
  }

  type Workspace {
    id: ID!
    name: String!
    description: String
    created_by: User!
    members: [WorkspaceMember!]!
    created_at: DateTime!
    updated_at: DateTime!
  }

  type ProjectMember {
    id: ID!
    user: User!
    role: String!
    joined_at: DateTime!
  }

  type Project {
    id: ID!
    workspace_id: ID!
    name: String!
    description: String
    created_by: User!
    members: [ProjectMember!]!
    tasks: [Task!]!
    created_at: DateTime!
    updated_at: DateTime!
  }

  type TaskAssignment {
    id: ID!
    user: User!
    assigned_at: DateTime!
  }

  type Task {
    id: ID!
    project_id: ID!
    title: String!
    description: String
    status: String!
    created_by: User!
    assigned_to: [TaskAssignment!]!
    created_at: DateTime!
    updated_at: DateTime!
  }

  type Notification {
    id: ID!
    recipient_id: ID!
    title: String!
    body: String!
    status: String!
    related_entity_id: ID
    related_entity_type: String
    created_at: DateTime!
    seen_at: DateTime
  }

  type AuditLog {
    id: ID!
    timestamp: DateTime!
    level: String!
    user_id: ID
    ip_address: String
    action: String!
    details: String
  }

  # Authentication Types
  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    user: User!
  }

  # Queries
  type Query {
    me: User!
    getUser(id: ID!): User
    getAllWorkspaces: [Workspace!]!
    getWorkspace(id: ID!): Workspace!
    getProject(id: ID!): Project!
    getTask(id: ID!): Task!
    getNotifications(limit: Int): [Notification!]!
    getUnseenNotifications: [Notification!]!
  }

  # Mutations
  type Mutation {
    # Authentication
    register(email: String!, password: String!, full_name: String!): AuthPayload!
    forgotPassword(email: String!): Boolean!
    updatePassword(oldPassword: String!, newPassword: String!): Boolean!
    
    # Admin Only
    banUser(userId: ID!): Boolean!
    unbanUser(userId: ID!): Boolean!
    adminResetPassword(userId: ID!, newPassword: String!): Boolean!
    
    # Workspace Management
    createWorkspace(name: String!, description: String): Workspace!
    addWorkspaceMember(workspaceId: ID!, userId: ID!): Boolean!
    removeWorkspaceMember(workspaceId: ID!, userId: ID!): Boolean!
    updateWorkspaceMemberRole(workspaceId: ID!, userId: ID!, role: String!): Boolean!
    
    # Project Management
    createProject(workspaceId: ID!, name: String!, description: String): Project!
    updateProject(id: ID!, name: String, description: String): Project!
    deleteProject(id: ID!): Boolean!
    addProjectMember(projectId: ID!, userId: ID!): Boolean!
    removeProjectMember(projectId: ID!, userId: ID!): Boolean!
    updateProjectMemberRole(projectId: ID!, userId: ID!, role: String!): Boolean!
    
    # Task Management
    createTask(projectId: ID!, title: String!, description: String, assignedToIds: [ID!]): Task!
    updateTask(id: ID!, title: String, description: String, status: String, assignedToIds: [ID!]): Task!
    deleteTask(id: ID!): Boolean!
    
    # Notification Management
    markNotificationAsSeen(notificationId: ID!): Boolean!
    
    # AI Features (Bonus)
    summarizeTask(taskDescription: String!): String!
    generateTasksFromPrompt(prompt: String!, projectId: ID!): [Task!]!
  }

  # Subscriptions
  type Subscription {
    taskStatusUpdated(workspaceId: ID!): Task!
  }
`;



