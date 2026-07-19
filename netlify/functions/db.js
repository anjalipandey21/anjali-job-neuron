// Netlify Function: /.netlify/functions/db
// Key-value store backed by Supabase.
// Mirrors the window.storage API used in the Claude artifact so
// the React app needs minimal changes.
// The Supabase service key never touches the browser.

const { createClient } = require('@supabase/supabase-js');
const { createLogger } = require('./lib/logger')

const getSupabase = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

exports.handler = async (event, context) => {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const { user } = context.clientContext || {};
  if (!user) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized — please sign in.' }),
    };
  }

  const userId = user.sub; // Netlify Identity subject (unique per user)
  const keyNs = exports.devKeyNs(); // isolate dev data from prod

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { action, key, value, prefix } = payload;
  const rid = event.headers['x-request-id'] || 'no-rid'
  const log = createLogger(rid)
  const sb = getSupabase();

  try {
    // ── GET ───────────────────────────────────────────────────────────────────
    if (action === 'get') {
      log.debug('db.get', { action, key })
      const { data, error } = await sb
        .from('kv_store')
        .select('value')
        .eq('user_id', userId)
        .eq('key', keyNs + key)
        .single();

      // PGRST116 = no rows found — that's fine, return null
      if (error && error.code !== 'PGRST116') throw error;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data ? { key, value: JSON.stringify(data.value) } : null),
      };
    }

    // ── SET ───────────────────────────────────────────────────────────────────
    if (action === 'set') {
      log.debug('db.set', { action, key })
      let parsed;
      try { parsed = JSON.parse(value); } catch { parsed = value; }

      const { error } = await sb
        .from('kv_store')
        .upsert(
          { user_id: userId, key: keyNs + key, value: parsed, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,key' }
        );

      if (error) throw error;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      };
    }

    // ── DELETE ────────────────────────────────────────────────────────────────
    if (action === 'delete') {
      log.debug('db.delete', { action, key })
      const { error } = await sb
        .from('kv_store')
        .delete()
        .eq('user_id', userId)
        .eq('key', keyNs + key);

      if (error) throw error;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, deleted: true }),
      };
    }

    // ── LIST ──────────────────────────────────────────────────────────────────
    if (action === 'list') {
      log.debug('db.list', { action, prefix })
      let query = sb
        .from('kv_store')
        .select('key')
        .eq('user_id', userId);

      if (prefix) query = query.like('key', `${keyNs}${prefix}%`);

      const { data, error } = await query;
      if (error) throw error;

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: (data || []).map((r) => r.key.slice(keyNs.length)) }),
      };
    }

    return { statusCode: 400, body: JSON.stringify({ error: `Unknown action: ${action}` }) };
  } catch (err) {
    log.error('db', { error: err.message })
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

// Exported for unit testing — returns the key namespace prefix for the current environment
exports.devKeyNs = () => process.env.NETLIFY_DEV ? 'dev_' : '';
