import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export type UserRole = 'admin' | 'editor' | 'none'

export interface PermissionCheck {
  isAdmin: boolean
  isEditor: boolean
  canEdit: boolean // true for both admin and editor
  canCreate: boolean // true only for admin
  canDelete: boolean // true only for admin
  userRole: UserRole
}

/**
 * Check user permissions for a specific league
 */
export async function checkUserPermissions(
  userEmail: string,
  leagueId: string
): Promise<PermissionCheck> {
  const supabase = createRouteHandlerClient({ cookies })

  try {
    // Check if user is admin
    const { data: adminCheck } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', leagueId)
      .eq('email', userEmail)
      .single()

    if (adminCheck) {
      return {
        isAdmin: true,
        isEditor: false,
        canEdit: true,
        canCreate: true,
        canDelete: true,
        userRole: 'admin'
      }
    }

    // Check if user is editor
    const { data: editorCheck } = await supabase
      .from('league_editors')
      .select('id')
      .eq('league_id', leagueId)
      .eq('email', userEmail)
      .single()

    if (editorCheck) {
      return {
        isAdmin: false,
        isEditor: true,
        canEdit: true,
        canCreate: false,
        canDelete: false,
        userRole: 'editor'
      }
    }

    // User has no permissions
    return {
      isAdmin: false,
      isEditor: false,
      canEdit: false,
      canCreate: false,
      canDelete: false,
      userRole: 'none'
    }
  } catch (error) {
    console.error('Error checking user permissions:', error)
    return {
      isAdmin: false,
      isEditor: false,
      canEdit: false,
      canCreate: false,
      canDelete: false,
      userRole: 'none'
    }
  }
}

/**
 * Quick check if user can edit (admin or editor)
 */
export async function canUserEdit(userEmail: string, leagueId: string): Promise<boolean> {
  const permissions = await checkUserPermissions(userEmail, leagueId)
  return permissions.canEdit
}

/**
 * Quick check if user is admin
 */
export async function isUserAdmin(userEmail: string, leagueId: string): Promise<boolean> {
  const permissions = await checkUserPermissions(userEmail, leagueId)
  return permissions.isAdmin
}

/**
 * Quick check if user is editor
 */
export async function isUserEditor(userEmail: string, leagueId: string): Promise<boolean> {
  const permissions = await checkUserPermissions(userEmail, leagueId)
  return permissions.isEditor
}
