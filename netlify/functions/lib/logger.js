// Structured JSON logger for Netlify functions.
// debug/info/warn only emit when DEBUG=true — error and metric always fire.
// isDebug is a function so process.env.DEBUG is read at call time (testable).

const isDebug = () => process.env.DEBUG === 'true'

function emit(level, rid, op, ctx) {
  const line = JSON.stringify({ level, ts: new Date().toISOString(), rid, op, ...ctx })
  if (level === 'error') { console.error(line); return }
  if (level === 'metric') { console.log(line); return }
  if (!isDebug()) return
  console.log(line)
}

function createLogger(rid = 'no-rid') {
  return {
    debug:  (op, ctx = {}) => emit('debug',  rid, op, ctx),
    info:   (op, ctx = {}) => emit('info',   rid, op, ctx),
    warn:   (op, ctx = {}) => emit('warn',   rid, op, ctx),
    error:  (op, ctx = {}) => emit('error',  rid, op, ctx),
    metric: (op, ctx = {}) => emit('metric', rid, op, ctx),
  }
}

module.exports = { createLogger }
