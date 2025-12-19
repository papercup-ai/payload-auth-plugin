import type { AuthStrategy } from 'payload'
import jwt from 'jsonwebtoken'

/**
 * Custom authentication strategy for OAuth flows
 * 
 * This strategy uses the __oauth-session cookie as the actual session cookie for
 * OAuth-authenticated users. The cookie contains a JWT with the user's ID and is
 * validated on each request.
 * 
 * Flow:
 * 1. OAuth callback validates OAuth and creates/finds user
 * 2. OAuth callback sets __oauth-session cookie (client-side, 2-hour expiration)
 * 3. User is redirected to /admin
 * 4. On each request, this strategy runs and validates the __oauth-session cookie
 * 5. If valid, returns the user (authenticates)
 * 6. Session persists for 2 hours or until cookie expires
 * 
 * Note: The cookie must be set client-side because Payload's custom endpoints
 * strip Set-Cookie headers (architectural limitation with Next.js App Router).
 */

const OAUTH_SESSION_COOKIE_NAME = '__oauth-session'
const OAUTH_SESSION_MAX_AGE = 7200 // 2 hours (same as default Payload token expiration)

interface OAuthSessionData {
  userId: string
  email: string
  collection: string
  timestamp: number
  validated: boolean
}

/**
 * Parse cookies from the Cookie header
 */
function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {}
  
  const cookies: Record<string, string> = {}
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=')
    if (name && rest.length > 0) {
      cookies[name] = rest.join('=')
    }
  })
  
  return cookies
}

/**
 * Verify the OAuth session token
 */
function verifyOAuthSession(
  sessionToken: string,
  secret: string
): OAuthSessionData | null {
  try {
    const decoded = jwt.verify(sessionToken, secret) as OAuthSessionData
    
    // Check if the session is still valid (not expired)
    const now = Date.now()
    const age = (now - decoded.timestamp) / 1000 // Convert to seconds
    
    if (age > OAUTH_SESSION_MAX_AGE) {
      console.log('[OAuth Strategy] Session expired:', age, 'seconds old')
      return null
    }
    
    if (!decoded.validated) {
      console.log('[OAuth Strategy] Session not validated')
      return null
    }
    
    return decoded
  } catch (error) {
    console.log('[OAuth Strategy] Invalid session token:', error instanceof Error ? error.message : 'Unknown error')
    return null
  }
}

/**
 * Create the OAuth authentication strategy
 */
export function createOAuthStrategy(userCollectionSlug: string): AuthStrategy {
  return {
    name: 'oauth',
    authenticate: async ({ headers, payload }) => {
      // Get cookies from the request
      const cookieHeader = headers.get('cookie')
      const cookies = parseCookies(cookieHeader)
      
      // Check for the OAuth session marker
      const sessionToken = cookies[OAUTH_SESSION_COOKIE_NAME]
      
      if (!sessionToken) {
        // No OAuth session marker, not an OAuth login
        return { user: null }
      }
      
      // Verify the session token
      const sessionData = verifyOAuthSession(sessionToken, payload.secret)
      
      if (!sessionData) {
        // Invalid or expired session
        return { user: null }
      }
      
      // Verify the collection matches
      if (sessionData.collection !== userCollectionSlug) {
        console.log('[OAuth Strategy] Collection mismatch:', sessionData.collection, 'vs', userCollectionSlug)
        return { user: null }
      }
      
      try {
        // Fetch the user from the database
        const user = await payload.findByID({
          collection: userCollectionSlug,
          id: sessionData.userId,
        })
        
        if (!user) {
          console.log('[OAuth Strategy] User not found:', sessionData.userId)
          return { user: null }
        }
        
        console.log('[OAuth Strategy] Successfully authenticated user:', user.email)
        
        // Return the authenticated user with strategy marker
        return {
          user: {
            ...user,
            collection: userCollectionSlug,
            _strategy: 'oauth',
          },
        }
      } catch (error) {
        console.error('[OAuth Strategy] Error fetching user:', error)
        return { user: null }
      }
    },
  }
}

/**
 * Generate an OAuth session token
 */
export function generateOAuthSessionToken(
  userId: string,
  email: string,
  collection: string,
  secret: string
): string {
  const sessionData: OAuthSessionData = {
    userId,
    email,
    collection,
    timestamp: Date.now(),
    validated: true,
  }
  
  return jwt.sign(sessionData, secret, {
    expiresIn: OAUTH_SESSION_MAX_AGE,
  })
}

/**
 * Generate the OAuth session cookie string for client-side setting
 */
export function generateOAuthSessionCookie(
  sessionToken: string,
  secure: boolean = false
): string {
  const parts = [
    `${OAUTH_SESSION_COOKIE_NAME}=${sessionToken}`,
    'Path=/',
    // Note: Cannot use HttpOnly for client-side cookie setting
    // The cookie is still reasonably secure with SameSite=Lax
    'SameSite=Lax',
    `Max-Age=${OAUTH_SESSION_MAX_AGE}`,
  ]
  
  if (secure) {
    parts.push('Secure')
  }
  
  return parts.join('; ')
}

/**
 * Generate an expired OAuth session cookie to clear it
 */
export function generateExpiredOAuthSessionCookie(): string {
  return `${OAUTH_SESSION_COOKIE_NAME}=; Path=/; SameSite=Lax; Max-Age=0`
}

export { OAUTH_SESSION_COOKIE_NAME }
