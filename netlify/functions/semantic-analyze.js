// Netlify Function: /.netlify/functions/semantic-analyze
// Runs TF-IDF semantic analysis between a resume and one or more job descriptions.
// Used by the ATS Score tab and job scoring.
// Pure computation — no AI call needed, instant response.

const { scoreSemanticMatch, batchScoreJobs } = require('./lib/semantic');
const { createLogger } = require('./lib/logger')

function parseJWT(authHeader) {
  try {
    const token = (authHeader || '').replace('Bearer ', '').trim();
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

exports.handler = async (event, context) => {
  // ── Auth ──────────────────────────────────────────────────────────────────────
  const { user: ctxUser } = context.clientContext || {};
  const user = ctxUser || parseJWT(event.headers?.authorization || event.headers?.Authorization);
  if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { mode, resumeText, jobText, jobs } = payload;

  if (!resumeText) {
    return { statusCode: 400, body: JSON.stringify({ error: 'resumeText required' }) };
  }

  const rid = event.headers['x-request-id'] || 'no-rid'
  const log = createLogger(rid)

  try {
    // ── Single job analysis (ATS tab) ─────────────────────────────────────────
    if (mode === 'single' || jobText) {
      const result = scoreSemanticMatch(resumeText, jobText || '')
      log.info('semanticAnalyze', { matchCount: Object.keys(result.keywords || result || {}).length })
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      }
    }

    // ── Batch scoring (Find Jobs) ─────────────────────────────────────────────
    if (mode === 'batch' && Array.isArray(jobs)) {
      const scores = batchScoreJobs(resumeText, jobs)
      log.info('semanticAnalyze', { matchCount: scores.length })
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores }),
      }
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'mode must be single or batch' }) };

  } catch (err) {
    log.error('semanticAnalyze', { error: err.message })
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
