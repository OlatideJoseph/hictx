// Thin client for the hictx context-graph API.
//
// The API host is configurable via VITE_API_BASE_URL:
//   - dev (.env.development) points straight at the Django host
//     (http://localhost:8000/api) — CORS is configured for this origin.
//   - unset, it falls back to the same-origin "/api" (works behind the Vite
//     dev proxy, and in production when frontend and API share an origin).
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const message =
      body.detail || body.url || JSON.stringify(body) || `HTTP ${res.status}`
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message))
  }
  return body
}

// Start a session for a repo (runs in the background). Returns the session with
// an id + status; poll getSession(id) to watch progress.
export function createSession({ url, token, ingest_issues, limit }) {
  return request('/sessions/', {
    method: 'POST',
    body: JSON.stringify({ url, token, ingest_issues, limit }),
  })
}

export function getSession(id) {
  return request(`/sessions/${id}/`)
}

// Resume a failed session (idempotent — skips already-ingested commits).
export function retrySession(id, token = '') {
  return request(`/sessions/${id}/retry/`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export function listRepositories() {
  return request('/repositories/')
}

// The repo's notable events in time order — the story view.
export function repositoryTimeline(id, limit = 200) {
  return request(`/repositories/${id}/timeline/?limit=${limit}`)
}

// The LLM-written narrative for a repo (cached). GET reads; POST (re)generates.
export function getStory(id) {
  return request(`/repositories/${id}/story/`)
}

export function generateStory(id) {
  return request(`/repositories/${id}/story/`, { method: 'POST' })
}

// Per-file story: ranked files worth a story, a file's timeline, and its narrative.
export function storyFiles(repoId) {
  return request(`/repositories/${repoId}/story-files/`)
}

export function entityTimeline(entityId) {
  return request(`/entities/${entityId}/timeline/`)
}

export function getEntityStory(entityId) {
  return request(`/entities/${entityId}/story/`)
}

export function generateEntityStory(entityId) {
  return request(`/entities/${entityId}/story/`, { method: 'POST' })
}

// The connected knowledge core (nodes + edges) for the graph preview.
export function repositoryGraph(id, { includeInferred = true, minConfidence = 0.5 } = {}) {
  const q = new URLSearchParams({
    include_inferred: String(includeInferred),
    min_confidence: String(minConfidence),
  })
  return request(`/repositories/${id}/graph/?${q}`)
}

// The unified diff a change introduced (read from the local clone).
export function changeDiff(id) {
  return request(`/changes/${id}/diff/`)
}

export function reviewQueue(status = 'inferred') {
  return request(`/review-queue/?status=${encodeURIComponent(status)}`)
}

export function reviewCounts() {
  return request('/review-queue/counts/')
}

// Draft change→decision links into the review queue (LLM if a key is set, else keyword).
export function draftLinks(repoId, opts = {}) {
  return request(`/repositories/${repoId}/draft-links/`, {
    method: 'POST',
    body: JSON.stringify(opts),
  })
}

// LLM key settings (the key is write-only and never returned).
export function getLlmSettings() {
  return request('/settings/llm/')
}

// Select a provider and optionally set its key/model. { provider, key?, model? }
export function saveLlmConfig(config) {
  return request('/settings/llm/', { method: 'PUT', body: JSON.stringify(config) })
}

// One-click confirm/reject on an inferred link or root cause.
// resource is one of: caused-by-edges, implements-edges, root-causes.
export function reviewAction(resource, id, action) {
  return request(`/${resource}/${id}/${action}/`, { method: 'POST' })
}
