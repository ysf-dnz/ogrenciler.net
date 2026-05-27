// src/core/permissions.js
import { state } from './state.js';

export const ROLE_PERMISSIONS = {
  admin: {
    canCreateTask: true,
    canEditAnyTask: true,
    canDeleteAnyTask: true,
    canManageMembers: true,
    canBulkActions: true,
    canClearActivity: true,
    canExportImport: true,
    canChangeRoles: true,
    canEditOwnTasksOnly: false,
    canDragTasks: true
  },
  member: {
    canCreateTask: true,
    canEditAnyTask: false,
    canEditOwnTasksOnly: true,
    canDeleteAnyTask: false,
    canManageMembers: false,
    canBulkActions: false,
    canClearActivity: false,
    canExportImport: false,
    canChangeRoles: false,
    canDragTasks: true
  },
  viewer: {
    canCreateTask: false,
    canEditAnyTask: false,
    canEditOwnTasksOnly: false,
    canDeleteAnyTask: false,
    canManageMembers: false,
    canBulkActions: false,
    canClearActivity: false,
    canExportImport: false,
    canChangeRoles: false,
    canDragTasks: false
  }
};

export const SYSTEM_ROLE_LABELS = {
  admin: 'Admin',
  member: 'Üye',
  viewer: 'İzleyici'
};

export function currentUser() {
  return state.members.find(m => m.id === state.loggedInUserId) || null;
}

export function hasPermission(permKey) {
  const user = currentUser();
  if (!user) return false;
  const perms = ROLE_PERMISSIONS[user.systemRole];
  return perms ? perms[permKey] === true : false;
}

export function canEditTask(task) {
  if (hasPermission('canEditAnyTask')) return true;
  if (!hasPermission('canEditOwnTasksOnly')) return false;
  return task.assigneeId === state.loggedInUserId || task.createdBy === state.loggedInUserId;
}

export function canDeleteTask(task) {
  if (hasPermission('canDeleteAnyTask')) return true;
  // Üye kendi oluşturduğu görevi silebilir
  if (hasPermission('canEditOwnTasksOnly') && task.createdBy === state.loggedInUserId) return true;
  return false;
}
