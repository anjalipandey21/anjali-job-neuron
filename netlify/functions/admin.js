// Netlify Function: /.netlify/functions/admin
// All admin operations go through here.
// Every request verifies:
//   1. Valid Netlify Identity JWT
//   2. Caller has role = 'admin' in user_roles table
// Non-admins get 403. Unauthenticated requests get 401.

const { createClient } = require('@supabase/supabase-js');
const { createLogger } = require('./lib/logger')

const getSupabase = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ── Verify caller is an admin ─────────────────────────────────────────────────
async function verifyAdmin(user, sb) {
  // Auto-register user in user_roles if first time (default role = 'user')
  const { data } = await sb
    .from('user_roles')
    .select('role, disabled')
    .eq('user_id', user.sub)
    .single();

  if (!data) {
    // First login — insert as regular user
    await sb.from('user_roles').upsert({
      user_id: user.sub,
      email: user.email,
      role: 'user',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    return false;
  }

  return data.role === 'admin' && !data.disabled;
}

exports.handler = async (event, context) => {
  // ── Auth ──────────────────────────────────────────────────────────────────────
  const { user } = context.clientContext || {};
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  let payload;
  try { payload = JSON.parse(event.body); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const sb = getSupabase();

  // ── Verify admin role ─────────────────────────────────────────────────────────
  const isAdmin = await verifyAdmin(user, sb);
  if (!isAdmin) return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden — admin access required.' }) };

  const { action } = payload;
  const rid = event.headers['x-request-id'] || 'no-rid'
  const log = createLogger(rid)
  log.info('admin.handler', { action })
  const ok = (data) => ({ statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  const err = (msg, code = 500) => ({ statusCode: code, body: JSON.stringify({ error: msg }) });

  try {
    // ── GET STATS ─────────────────────────────────────────────────────────────
    // Returns platform-wide summary numbers
    if (action === 'get_stats') {
      const [rolesRes, kvRes] = await Promise.all([
        sb.from('user_roles').select('role, disabled, created_at'),
        sb.from('kv_store').select('key, user_id, updated_at'),
      ]);

      const roles = rolesRes.data || [];
      const kv    = kvRes.data   || [];

      const today = new Date().toISOString().split('T')[0];

      return ok({
        totalUsers:       roles.filter((r) => r.role === 'user').length,
        totalAdmins:      roles.filter((r) => r.role === 'admin').length,
        disabledUsers:    roles.filter((r) => r.disabled).length,
        totalProfiles:    kv.filter((k) => k.key === 'jh_profiles').length,
        totalApplications: kv.filter((k) => k.key.startsWith('jh_apps_')).reduce((sum, k) => {
          try { const v = k; return sum; } catch { return sum; }
        }, 0),
        jobSearchesToday: kv.filter((k) => k.key.includes(`_${today}`)).length,
        newUsersThisWeek: roles.filter((r) => {
          const d = new Date(r.created_at);
          return (Date.now() - d.getTime()) < 7 * 24 * 60 * 60 * 1000;
        }).length,
      });
    }

    // ── LIST USERS ────────────────────────────────────────────────────────────
    // Returns all users with their role + basic usage stats
    if (action === 'list_users') {
      const { data: roles, error: rolesErr } = await sb
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false });

      if (rolesErr) throw rolesErr;

      // For each user, count their profiles and applications from kv_store
      const { data: kv } = await sb
        .from('kv_store')
        .select('user_id, key, updated_at');

      const kvByUser = (kv || []).reduce((acc, row) => {
        if (!acc[row.user_id]) acc[row.user_id] = [];
        acc[row.user_id].push(row);
        return acc;
      }, {});

      const users = (roles || []).map((r) => {
        const rows = kvByUser[r.user_id] || [];
        const profilesRow = rows.find((k) => k.key === 'jh_profiles');
        const appRows = rows.filter((k) => k.key.startsWith('jh_apps_'));
        const lastActive = rows.reduce((latest, k) => {
          return k.updated_at > latest ? k.updated_at : latest;
        }, r.created_at);

        return {
          userId:       r.user_id,
          email:        r.email,
          role:         r.role,
          disabled:     r.disabled,
          createdAt:    r.created_at,
          lastActive,
          profileCount: profilesRow ? 1 : 0,
          appRowCount:  appRows.length,
        };
      });

      return ok({ users });
    }

    // ── GET USER DETAIL ───────────────────────────────────────────────────────
    // Returns all kv data for a specific user so admin can drill in
    if (action === 'get_user_detail') {
      const { targetUserId } = payload;
      if (!targetUserId) return err('targetUserId required', 400);

      const { data: roleRow } = await sb
        .from('user_roles')
        .select('*')
        .eq('user_id', targetUserId)
        .single();

      const { data: kvRows } = await sb
        .from('kv_store')
        .select('key, value, updated_at')
        .eq('user_id', targetUserId)
        .order('updated_at', { ascending: false });

      // Parse profiles
      const profilesRow = (kvRows || []).find((r) => r.key === 'jh_profiles');
      const profiles = profilesRow?.value || [];

      // For each profile find its jobs and applications
      const enriched = profiles.map((p) => {
        const appRow  = (kvRows || []).find((r) => r.key === `jh_apps_${p.id}`);
        const jobRows = (kvRows || []).filter((r) => r.key.startsWith(`jh_jobs_${p.id}_`));
        return {
          ...p,
          applications: appRow?.value || [],
          jobSearches: jobRows.map((r) => ({ date: r.key.split('_').pop(), jobs: r.value || [], updatedAt: r.updated_at })),
        };
      });

      return ok({ user: roleRow, profiles: enriched });
    }

    // ── SET ROLE ──────────────────────────────────────────────────────────────
    if (action === 'set_role') {
      const { targetUserId, role } = payload;
      if (!targetUserId || !['admin', 'user'].includes(role)) return err('Invalid params', 400);
      // Prevent self-demotion
      if (targetUserId === user.sub && role !== 'admin') return err('Cannot remove your own admin role', 400);

      const { error: e } = await sb
        .from('user_roles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('user_id', targetUserId);

      if (e) throw e;
      return ok({ success: true });
    }

    // ── DISABLE / ENABLE USER ─────────────────────────────────────────────────
    if (action === 'set_disabled') {
      const { targetUserId, disabled } = payload;
      if (!targetUserId || typeof disabled !== 'boolean') return err('Invalid params', 400);
      if (targetUserId === user.sub) return err('Cannot disable yourself', 400);

      const { error: e } = await sb
        .from('user_roles')
        .update({ disabled, updated_at: new Date().toISOString() })
        .eq('user_id', targetUserId);

      if (e) throw e;
      return ok({ success: true });
    }

    // ── DELETE USER DATA ──────────────────────────────────────────────────────
    if (action === 'delete_user') {
      const { targetUserId } = payload;
      if (!targetUserId) return err('targetUserId required', 400);
      if (targetUserId === user.sub) return err('Cannot delete yourself', 400);

      // Delete all kv data and role row
      await Promise.all([
        sb.from('kv_store').delete().eq('user_id', targetUserId),
        sb.from('user_roles').delete().eq('user_id', targetUserId),
      ]);

      return ok({ success: true });
    }

    return err(`Unknown action: ${action}`, 400);

  } catch (e) {
    log.error('admin.handler', { error: e.message })
    return err(e.message);
  }
};
