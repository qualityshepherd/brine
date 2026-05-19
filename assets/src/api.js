export const apiFetch = async (path, method, body) => {
  const opts = { method }
  if (body) {
    opts.headers = { 'Content-Type': 'application/json' }
    opts.body = JSON.stringify(body)
  }
  try {
    const res = await fetch(path, opts)
    const data = await res.json()
    if (res.status === 401) {
      const draft = document.getElementById('blog-editor')?.value
      if (draft) sessionStorage.setItem('feedi_rescue_draft', draft)
      location.reload()
      return { error: 'unauthorized' }
    }
    if (!res.ok) return { error: data.error || `HTTP ${res.status}` }
    return data
  } catch (err) {
    return { error: err.message || 'network error' }
  }
}
