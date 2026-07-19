// Structured JSON logger for the frontend.
// debug/info/warn only emit when jh_debug is active — error always fires.
// isDebug() is evaluated at emit time so the toggle takes effect immediately.

function isDebug() {
  try {
    const stored = localStorage.getItem('jh_debug')
    if (stored !== null) return stored === 'true'
  } catch {}
  return import.meta.env.VITE_DEBUG === 'true'
}

function emit(level, op, ctx) {
  if (level !== 'error' && !isDebug()) return
  const line = JSON.stringify({ level, ts: new Date().toISOString(), op, ...ctx })
  if (level === 'error') { console.error(line); return }
  if (level === 'warn') console.warn(line)
  // eslint-disable-next-line no-console
  else if (level === 'info') console.info(line)
  // eslint-disable-next-line no-console
  else console.debug(line)
}

function makeLogger(defaults = {}) {
  return {
    debug:   (op, ctx = {}) => emit('debug', op, { ...defaults, ...ctx }),
    info:    (op, ctx = {}) => emit('info',  op, { ...defaults, ...ctx }),
    warn:    (op, ctx = {}) => emit('warn',  op, { ...defaults, ...ctx }),
    error:   (op, ctx = {}) => emit('error', op, { ...defaults, ...ctx }),
    withRid: (rid) => makeLogger({ ...defaults, rid }),
  }
}

export const logger = makeLogger()
