import cors from 'cors'
import type { Request, RequestHandler } from 'express'
import helmet from 'helmet'

const defaultClientOrigins = ['http://localhost:5173']
const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

// CLIENT_ORIGIN is a comma-separated allowlist, e.g. "https://tutors.example.com".
export function allowedClientOrigins(): string[] {
  const configured = process.env.CLIENT_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean)
  return configured?.length ? configured : defaultClientOrigins
}

function isSameHost(origin: string, request: Request) {
  try {
    return new URL(origin).host === request.get('host')
  } catch {
    return false
  }
}

function isAllowedOrigin(origin: string, request: Request) {
  return allowedClientOrigins().includes(origin) || isSameHost(origin, request)
}

// The production app is served by Express itself, so everything is same-origin.
// Recharts styles SVG through React style props (CSSOM), which style-src does not block.
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      // HSTS covers HTTPS in production; upgrading would break plain-HTTP local production checks.
      upgradeInsecureRequests: null,
    },
  },
  frameguard: { action: 'deny' },
})

export const corsPolicy: RequestHandler = (request, response, next) => {
  cors({
    origin: (origin, callback) => callback(null, !origin || isAllowedOrigin(origin, request)),
    credentials: true,
  })(request, response, next)
}

// Defence in depth alongside SameSite=Strict: browsers send Origin on cross-site writes.
export const rejectCrossOriginWrites: RequestHandler = (request, response, next) => {
  const origin = request.get('origin')
  if (safeMethods.has(request.method) || !origin || isAllowedOrigin(origin, request)) {
    next()
    return
  }
  response.status(403).json({ error: 'Cross-origin requests are not allowed.' })
}
