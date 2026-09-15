import { getServiceClient, getUserClient } from '../_shared/db.ts';
import { errorJson, json, preflight } from '../_shared/http.ts';

/**
 * delete-account — server-side account-deletion cascade (RESEARCH Pattern 4).
 *
 * No FK cascade exists from auth.users to any app table, so every table with
 * a bare user_id/supabase_user_id column is purged explicitly before the
 * user row itself is deleted. The target uid is derived exclusively from the
 * caller's own verified JWT (never a request body field) — an IDOR here
 * would let any authenticated user delete any other account (Security
 * Domain V4). Row deletes run before admin.deleteUser so a mid-failure retry
 * still has a valid session to retry with.
 */

const CASCADE_TABLES = ['diary_entries', 'sync_operations', 'scan_items', 'scans', 'scan_usage'] as const;

export async function handler(req: Request): Promise<Response> {
  try {
    const cors = preflight(req);
    if (cors) return cors;

    const userClient = getUserClient(req);
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return errorJson(401, 'UNAUTHORIZED');
    const uid = authData.user.id;

    const admin = getServiceClient();
    for (const table of CASCADE_TABLES) {
      const { error } = await admin.from(table).delete().eq('user_id', uid);
      if (error) throw error;
    }
    const { error: entitlementsError } = await admin
      .from('entitlements')
      .delete()
      .eq('supabase_user_id', uid);
    if (entitlementsError) throw entitlementsError;

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(uid);
    if (deleteUserError) throw deleteUserError;

    return json(200, { deleted: true });
  } catch (error) {
    console.error('delete-account failed', error);
    return errorJson(500, 'INTERNAL');
  }
}

if (import.meta.main) Deno.serve(handler);
