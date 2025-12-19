# Alternative Approaches Investigation

**Date**: December 18, 2025  
**Plugin Version**: 0.7.0  
**Payload CMS**: 3.68.5  
**Next.js**: 15.4.10  
**Status**: Active Investigation

---

## Overview

After 8+ failed attempts to set cookies from Payload custom endpoints, we are investigating alternative approaches to complete OAuth authentication. This document explores viable solutions based on Payload's official documentation and working examples.

---

## Option 1: Use Payload's afterLogin Hook ✅ **MOST PROMISING**

### Concept

Instead of trying to set cookies in the custom endpoint, leverage Payload's `afterLogin` hook which **does** have access to set response headers correctly.

### How It Works

1. OAuth callback validates the OAuth flow (as it does now)
2. Instead of generating JWT + setting cookie, **call `payload.login()`**
3. Payload's login operation triggers `afterLogin` hook
4. Hook receives the JWT and can set cookies via `req.responseHeaders`

### Implementation Strategy

```typescript
// In OAuth callback handler (src/core/session/payload.ts)
export async function payloadOAuthCallback(...) {
  // 1. Validate OAuth, get user/create account (existing code works)
  const oauthAccountInfo = await validateOAuth(...)
  const user = await findOrCreateUser(...)
  
  // 2. Instead of generating JWT manually, call payload.login()
  // This triggers the entire login flow including hooks
  const loginResult = await payload.login({
    collection: usersCollectionSlug,
    data: { 
      email: user.email,
      // Use a special marker to bypass password check
      bypassAuth: true // Custom field we'll handle in strategy
    },
    req, // Pass the request - this is KEY
  })
  
  // 3. Login operation automatically sets cookie via afterLogin hook
  // Redirect happens here with cookie already set
  return Response.redirect(successURL.href, 302)
}

// Register custom auth strategy to handle "bypassAuth"
const oauthStrategy: AuthStrategy = {
  name: 'oauth-bypass',
  authenticate: async ({ payload, headers }) => {
    // Check for special OAuth marker in session
    const oauthSession = getOAuthSessionFromCookie(headers)
    if (oauthSession?.validated) {
      const user = await payload.findByID({
        collection: 'users',
        id: oauthSession.userId,
      })
      return { user }
    }
    return { user: null }
  }
}
```

### Example from Payload Codebase

**File**: `examples/auth/src/collections/hooks/loginAfterCreate.ts`

```typescript
export const loginAfterCreate: AfterChangeHook = async ({
  doc,
  operation,
  req,
  req: { body = {}, payload, res },
}) => {
  if (operation === 'create') {
    const { email, password } = body

    if (email && password) {
      const { token, user } = await payload.login({
        collection: 'users',
        data: { email, password },
        req,
        res, // Passing res allows cookies to be set
      })

      return {
        ...doc,
        token,
        user,
      }
    }
  }

  return doc
}
```

### Key Discovery

From `packages/next/src/auth/login.ts`:

```typescript
export async function login({ collection, config, email, password, username }: LoginArgs) {
  const payload = await getPayload({ config })
  
  const result = await payload.login({
    collection,
    data: loginData,
  })

  if (result.token) {
    // THIS is the magic - Server Actions can set cookies!
    await setPayloadAuthCookie({
      authConfig,
      cookiePrefix: payload.config.cookiePrefix,
      token: result.token,
    })
  }

  return result
}
```

And `packages/next/src/utilities/setPayloadAuthCookie.ts`:

```typescript
export async function setPayloadAuthCookie({ authConfig, cookiePrefix, token }) {
  const cookies = await getCookies() // Next.js cookies() from 'next/headers'

  const payloadCookie = generatePayloadCookie({
    collectionAuthConfig: authConfig,
    cookiePrefix,
    token,
  })

  if (payloadCookie.value) {
    // This WORKS because we're in a Server Action context
    cookies.set(payloadCookie.name, payloadCookie.value, {
      domain: authConfig.cookies.domain,
      expires: payloadCookie.expires ? new Date(payloadCookie.expires) : undefined,
      httpOnly: true,
      sameSite: authConfig.cookies.sameSite,
      secure: authConfig.cookies.secure,
    })
  }
}
```

### Why This Works

1. **Server Actions** (marked with `'use server'`) can set cookies
2. `setPayloadAuthCookie` uses Next.js `cookies()` API which works in Server Actions
3. Payload's login operation can be called from OAuth callback
4. We bypass the custom endpoint cookie issue entirely

---

## Option 2: Convert OAuth Callback to Server Action ✅ **VIABLE**

### Concept

Instead of a Payload custom endpoint, export a Server Action that handles the OAuth callback.

### Implementation

```typescript
// src/core/session/oauthCallback.ts
'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function handleOAuthCallback(code: string, state: string) {
  const payload = await getPayload({ config })
  
  // Validate OAuth (existing logic)
  const oauthAccountInfo = await validateOAuth(code, state)
  const user = await findOrCreateUser(oauthAccountInfo)
  
  // Generate JWT (existing logic)
  const token = jwt.sign(...)
  
  // Set cookie - THIS WORKS in Server Actions
  const cookieStore = await cookies()
  cookieStore.set('payload-token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7200, // 2 hours
    path: '/',
  })
  
  // Redirect
  redirect('/admin')
}
```

### User Setup Required

```typescript
// app/api/auth/callback/[provider]/route.ts (User creates this)
import { handleOAuthCallback } from '@papercup/payload-auth-plugin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  
  return handleOAuthCallback(code, state)
}
```

### Pros
- Clean separation (authorization = plugin, callback = user app)
- Server Actions guarantee cookie setting works
- Plugin exports reusable logic

### Cons
- Requires manual route creation (not pure plugin)
- User must understand Server Actions
- More complex setup

---

## Option 3: Use Payload's afterLogin Hook (Collection Level) ✅ **RECOMMENDED**

### Concept

Register an `afterLogin` hook on the Users collection that sets additional cookies when OAuth login completes.

### Implementation

**In plugin** (src/plugins/admin.ts):

```typescript
export const adminAuthPlugin = (pluginOptions: PluginOptions) => {
  return (config: Config) => {
    return {
      ...config,
      collections: config.collections.map((collection) => {
        if (collection.slug === pluginOptions.usersCollectionSlug) {
          return {
            ...collection,
            auth: {
              ...collection.auth,
              strategies: [
                ...(collection.auth.strategies || []),
                {
                  name: 'oauth-strategy',
                  authenticate: async ({ headers, payload }) => {
                    // Check for temporary OAuth session marker
                    const oauthSession = parseOAuthSessionCookie(headers)
                    if (oauthSession?.validated) {
                      const user = await payload.findByID({
                        collection: pluginOptions.usersCollectionSlug,
                        id: oauthSession.userId,
                      })
                      return { user: { ...user, _strategy: 'oauth' } }
                    }
                    return { user: null }
                  },
                },
              ],
            },
            hooks: {
              ...collection.hooks,
              afterLogin: [
                ...(collection.hooks?.afterLogin || []),
                async ({ req, user }) => {
                  // If this was an OAuth login (check strategy)
                  if (user._strategy === 'oauth') {
                    // Clear the temporary OAuth session marker
                    const clearCookie = generateCookie({
                      name: 'oauth-session',
                      value: '',
                      maxAge: -1,
                      path: '/',
                      returnCookieAsObject: false,
                    })
                    
                    if (!req.responseHeaders) {
                      req.responseHeaders = new Headers()
                    }
                    req.responseHeaders.append('Set-Cookie', clearCookie)
                  }
                  
                  return user
                },
              ],
            },
          }
        }
        return collection
      }),
    }
  }
}
```

**In OAuth callback**:

```typescript
// After validating OAuth and creating/finding user
// 1. Set temporary OAuth session marker
const oauthSessionCookie = generateCookie({
  name: 'oauth-session',
  value: JSON.stringify({ userId: user.id, validated: true }),
  maxAge: 300, // 5 minutes
  httpOnly: true,
  path: '/',
  returnCookieAsObject: false,
})

// 2. This cookie CAN be set (short-lived, not auth cookie)
// We use HTML response with meta refresh
const html = `
  <html>
    <head>
      <meta http-equiv="refresh" content="0; url=/admin" />
      <script>
        document.cookie = "${oauthSessionCookie}";
        window.location.href = "/admin";
      </script>
    </head>
  </html>
`

return new Response(html, {
  status: 200,
  headers: {
    'Content-Type': 'text/html',
  },
})

// 3. When user lands on /admin, Payload runs auth strategies
// 4. Our oauth-strategy finds the oauth-session cookie
// 5. Returns the user
// 6. Payload's login flow triggers, sets payload-token cookie
// 7. afterLogin hook clears oauth-session cookie
```

### Example from Payload Codebase

**File**: `examples/multi-tenant/src/collections/Users/hooks/setCookieBasedOnDomain.ts`

```typescript
export const setCookieBasedOnDomain: CollectionAfterLoginHook = async ({ req, user }) => {
  const relatedOrg = await req.payload.find({
    collection: 'tenants',
    where: { domain: { equals: req.headers.get('host') } },
  })

  if (relatedOrg && relatedOrg.docs.length > 0) {
    const tenantCookie = generateCookie({
      name: 'payload-tenant',
      expires: getCookieExpiration({ seconds: 7200 }),
      path: '/',
      returnCookieAsObject: false,
      value: String(relatedOrg.docs[0].id),
    })

    // THIS WORKS - afterLogin can set cookies via req.responseHeaders
    const newHeaders = new Headers({
      'Set-Cookie': tenantCookie as string,
    })

    req.responseHeaders = mergeHeaders(req.responseHeaders || new Headers(), newHeaders)
  }
  
  return user
}
```

### Why This Works

1. `afterLogin` hook has access to `req.responseHeaders`
2. Payload automatically merges `req.responseHeaders` into the response
3. OAuth custom strategy authenticates the user
4. Normal login flow proceeds, setting the auth cookie
5. Hook adds any additional cookies needed

---

## Option 4: Custom Auth Strategy + Manual Login Call ✅ **MOST FLEXIBLE**

### Concept

Combine a custom authentication strategy with manual call to `payload.login()` from the OAuth callback.

### Implementation

**Register custom strategy** (in plugin):

```typescript
const oauthStrategy: AuthStrategy = {
  name: 'oauth',
  authenticate: async ({ headers, payload }) => {
    // Check for special OAuth temp token
    const oauthToken = headers.get('X-OAuth-Temp-Token')
    if (!oauthToken) return { user: null }
    
    try {
      const { userId } = jwt.verify(oauthToken, payload.secret)
      const user = await payload.findByID({
        collection: 'users',
        id: userId,
      })
      
      return {
        user: { ...user, collection: 'users', _strategy: 'oauth' }
      }
    } catch {
      return { user: null }
    }
  }
}

// Add to users collection
config.collections.map(c => {
  if (c.slug === 'users') {
    return {
      ...c,
      auth: {
        ...c.auth,
        strategies: [...(c.auth.strategies || []), oauthStrategy]
      }
    }
  }
  return c
})
```

**In OAuth callback**:

```typescript
export async function oauthCallback(req: PayloadRequest) {
  // 1. Validate OAuth
  const oauthAccountInfo = await validateOAuth(...)
  const user = await findOrCreateUser(...)
  
  // 2. Create temporary OAuth token (short-lived)
  const tempToken = jwt.sign(
    { userId: user.id, type: 'oauth-temp' },
    req.payload.secret,
    { expiresIn: '5m' }
  )
  
  // 3. Call payload.login() with custom strategy
  // This creates a new request with the temp token in headers
  const loginReq = {
    ...req,
    headers: new Headers({
      ...Object.fromEntries(req.headers.entries()),
      'X-OAuth-Temp-Token': tempToken,
    })
  }
  
  const loginResult = await req.payload.login({
    collection: 'users',
    data: {}, // Empty data, auth happens via strategy
    req: loginReq,
  })
  
  // 4. Login operation sets the cookie automatically
  // Extract the Set-Cookie header from login result
  const setCookieHeader = loginResult.setCookie // If available
  
  // 5. Redirect with cookie
  return Response.redirect('/admin', {
    headers: {
      'Set-Cookie': setCookieHeader,
    }
  })
}
```

### Pros
- Leverages Payload's built-in login flow
- Custom strategy provides flexibility
- No user setup required (pure plugin)

### Cons
- Complex flow with temporary tokens
- Requires deep understanding of Payload auth

---

## Option 5: Use Next.js Middleware (❌ NOT RECOMMENDED)

### Why Not

- Middleware runs on EVERY request (performance concern)
- Cannot access Payload easily from middleware
- Complex to configure correctly
- Overkill for this use case

---

## Recommended Solution: Option 3 (afterLogin Hook)

### Why Option 3 is Best

1. **Works within Payload's architecture** - Uses documented hooks
2. **No user setup required** - Pure plugin solution
3. **Proven to work** - Multi-tenant example shows it works
4. **Clean separation** - OAuth validation + Payload authentication separate
5. **Reliable** - Leverages Payload's cookie management

### Implementation Plan

1. **Phase 1**: Create custom OAuth auth strategy
   - Checks for temporary OAuth session marker cookie
   - Returns user if session valid

2. **Phase 2**: Update OAuth callback endpoint
   - After validating OAuth, set temp session cookie (client-side)
   - Redirect to /admin (or call login endpoint programmatically)

3. **Phase 3**: Add afterLogin hook
   - Clears temporary OAuth session cookie
   - Payload has already set the payload-token cookie

4. **Phase 4**: Test end-to-end
   - Verify OAuth flow completes
   - Verify cookies are set correctly
   - Verify session persists

### Estimated Effort

- **Phase 1**: 2 hours (custom strategy)
- **Phase 2**: 2 hours (callback updates)
- **Phase 3**: 1 hour (afterLogin hook)
- **Phase 4**: 2 hours (testing)
- **Total**: ~7 hours

---

## Alternative: Option 1 (Call payload.login())

### Why Option 1 is Also Viable

1. **Simpler implementation** - Directly call `payload.login()`
2. **Leverages Server Actions** - Uses `setPayloadAuthCookie`
3. **Works with existing code** - Minimal changes to validation logic

### Challenge

- Need to call `payload.login()` from within a custom endpoint
- May need to create a hybrid approach:
  - Custom endpoint handles OAuth validation
  - Calls Server Action to set cookie
  - Server Action calls `setPayloadAuthCookie`

### Example Hybrid

```typescript
// src/client/completeOAuth.ts (Server Action)
'use server'

import { setPayloadAuthCookie } from '@payloadcms/next/utilities'

export async function completeOAuthLogin(token: string, userId: string) {
  const payload = await getPayload({ config })
  const collection = payload.collections['users']
  
  await setPayloadAuthCookie({
    authConfig: collection.config.auth,
    cookiePrefix: payload.config.cookiePrefix,
    token,
  })
  
  return { success: true }
}

// In OAuth callback endpoint
export async function oauthCallback(req) {
  // Validate OAuth, get user
  const token = jwt.sign(...)
  
  // Call Server Action to set cookie
  await completeOAuthLogin(token, user.id)
  
  return Response.redirect('/admin')
}
```

**Issue**: Server Actions can't be called from Payload custom endpoints directly.

---

## Next Steps

1. **Implement Option 3** (afterLogin hook approach)
2. **Test thoroughly** with Auth0
3. **Document setup** for future maintainers
4. **Open GitHub issue** on Payload repo about cookie limitation

---

## References

- Payload Multi-Tenant Example: `examples/multi-tenant/src/collections/Users/hooks/setCookieBasedOnDomain.ts`
- Payload Server Functions: `docs/local-api/server-functions.mdx`
- Payload Custom Strategies: `docs/authentication/custom-strategies.mdx`
- Login After Create Hook: `examples/auth/src/collections/hooks/loginAfterCreate.ts`
- setPayloadAuthCookie: `packages/next/src/utilities/setPayloadAuthCookie.ts`

---

**Status**: Ready to implement Option 3  
**Next Action**: Create custom OAuth auth strategy and afterLogin hook  
**Expected Result**: OAuth authentication completes with cookies set correctly
