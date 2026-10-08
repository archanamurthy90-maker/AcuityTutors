export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api'
export const sessionExpiredMessage = 'Your session has expired, please sign in again.'

type UnauthorizedHandler = (message: string) => void
let unauthorizedHandler: UnauthorizedHandler | null = null

// The AuthProvider registers this so any protected request can end the session.
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler
}

// For requests made while signed in: any 401 means the session ended (an expired
// cookie is dropped by the browser, so the server may only see a missing token).
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${apiBaseUrl}${path}`, { credentials: 'include', ...init })
  if (response.status === 401) unauthorizedHandler?.(sessionExpiredMessage)
  return response
}

// On page load, only an explicitly expired token deserves a notice; a missing
// token is the normal signed-out state.
export function sessionNoticeFromMe(status: number, body: unknown): string {
  if (status !== 401 || typeof body !== 'object' || body === null) return ''
  return (body as { code?: unknown }).code === 'SESSION_EXPIRED' ? sessionExpiredMessage : ''
}

// Proxies such as Cloud Run answer some failures with plain text (for example
// "upstream request timeout"), so a response body is not always JSON (BUG-09).
export function friendlyStatusMessage(status: number) {
  if (status === 504 || status === 408) return 'The server took too long to respond. Please try again in a moment.'
  if (status === 502 || status === 503) return 'The service is temporarily unavailable. Please try again in a moment.'
  if (status === 429) return 'Too many requests right now. Please wait a moment and try again.'
  return 'Something went wrong. Please try again.'
}

// Parses a JSON body; for a non-JSON body returns { error } with a friendly message for the status.
export async function readApiJson(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => '')
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return { error: friendlyStatusMessage(response.ok ? 500 : response.status) }
  }
}
