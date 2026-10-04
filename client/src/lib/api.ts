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
