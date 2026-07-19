export const uid = () => Math.random().toString(36).slice(2, 9)

export const todayStr = () => new Date().toISOString().split('T')[0]

export const fmtDate = (s) =>
  s ? new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

export function parseJSON(str) {
  try { return JSON.parse(str.trim()) } catch {}
  const cb = str.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (cb) try { return JSON.parse(cb[1].trim()) } catch {}
  const arr = str.match(/\[[\s\S]*\]/)
  if (arr) try { return JSON.parse(arr[0]) } catch {}
  const obj = str.match(/\{[\s\S]*\}/s)
  if (obj) try { return JSON.parse(obj[0]) } catch {}
  return null
}
