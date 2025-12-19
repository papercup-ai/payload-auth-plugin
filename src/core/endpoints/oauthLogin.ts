import type { PayloadHandler } from 'payload'

/**
 * OAuth Login Endpoint
 * 
 * This endpoint is called after OAuth authentication completes.
 * It confirms authentication and clears temporary OAuth flow cookies.
 * 
 * Flow:
 * 1. Client sets __oauth-session cookie (client-side)
 * 2. Client calls this endpoint
 * 3. OAuth strategy authenticates user (via middleware)
 * 4. This endpoint confirms authentication
 * 5. Clears temporary OAuth flow cookies (server-side)
 * 6. Returns success, client redirects to admin
 */
export const createOAuthLoginEndpoint = (): PayloadHandler => {
  return async (req) => {
    try {
      // The OAuth strategy will have already authenticated the user
      // via the authenticate middleware, so req.user should be populated
      if (!req.user) {
        return Response.json(
          { error: 'Not authenticated' },
          { status: 401 }
        )
      }

      const user = req.user

      console.log('[OAuth Login] Authenticated user via OAuth strategy:', user.email)
      console.log('[OAuth Login] Session will be maintained via __oauth-session cookie')
      
      // Clear temporary OAuth flow cookies (they're HttpOnly, so must be cleared server-side)
      const clearCodeVerifier = '__session-code-verifier=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax'
      const clearOAuthState = '__session-oauth-state=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax'
      
      const headers = new Headers()
      headers.set('Content-Type', 'application/json')
      headers.append('Set-Cookie', clearCodeVerifier)
      headers.append('Set-Cookie', clearOAuthState)
      
      console.log('[OAuth Login] Clearing temporary OAuth flow cookies')
      
      // The OAuth strategy has authenticated the user using the __oauth-session cookie
      // This cookie will continue to be used for authentication on subsequent requests
      return new Response(
        JSON.stringify({
          message: 'Login successful',
          user: {
            id: user.id,
            email: user.email,
          },
        }),
        {
          status: 200,
          headers,
        }
      )
    } catch (error) {
      console.error('[OAuth Login] Error:', error)
      return Response.json(
        { error: 'Login failed' },
        { status: 500 }
      )
    }
  }
}
