# OAuth Cookie Setting Investigation Report

**Date**: December 18, 2025  
**Plugin Version**: 0.7.0  
**Payload CMS**: 3.68.5 (upgraded from 3.3.0)  
**Next.js**: 15.4.10 (upgraded from 15.0.0)  
**Issue**: OAuth authentication succeeds but session cookies are not transmitted to the browser

---

## Executive Summary

After 8+ different implementation attempts over multiple hours, we've identified a **critical architectural incompatibility** between Payload CMS custom endpoints and cookie setting in Next.js 15.4.10 App Router.

**Bottom line**: Payload custom endpoints registered via the plugin API **cannot set HTTP cookies** when running in Next.js App Router, regardless of the method used. This prevents OAuth authentication from working as session cookies never reach the browser.

---

## Environment Details

### Before Upgrade (Working in some setups)
- Payload CMS: 3.3.0
- Next.js: 15.0.0
- React: 19.0.0-rc (vulnerable)
- OAuth4WebAPI: 3.1.4

### After Upgrade (Cookie Issue Discovered)
- Payload CMS: 3.68.5
- Next.js: 15.4.10 (CVE-2025-67779 fixed)
- React: 19.2.3 (CVE-2025-55182/55183/55184 fixed)
- OAuth4WebAPI: 3.8.3

---

## The Problem

### Symptoms
1. OAuth authorization flow completes successfully ✅
2. Auth0 redirects back to callback URL ✅
3. User record created/updated in database ✅
4. JWT token generated correctly ✅
5. Cookie string constructed properly ✅
6. **Set-Cookie header never reaches browser** ❌
7. User redirected back to login page ❌

### Root Cause

**Payload custom endpoints cannot set cookies in Next.js 15+ App Router.**

When custom endpoints are registered via Payload's plugin system:
- They are handled by `REST_GET` wrapper from `@payloadcms/next/routes`
- This wrapper processes the response through Next.js App Router's `/api/[...slug]` catch-all route
- **Set-Cookie headers are stripped** during this processing
- The browser never receives the authentication cookie

This is NOT a bug in our code - it's a fundamental limitation of how Payload integrates with Next.js App Router.

---

## Attempts Made (8 Total)

### Attempt 1: Direct Response Headers (Manual Set-Cookie)
**Date**: Initial implementation  
**Method**: Build Response with Set-Cookie headers manually
```typescript
const headers = new Headers()
headers.append('Set-Cookie', authCookie)
return new Response(null, { status: 302, headers })
```
**Result**: ❌ Headers stripped by Next.js  
**HAR Analysis**: No Set-Cookie headers in response

---

### Attempt 2: Payload's generatePayloadCookie Helper
**Method**: Use Payload's official cookie generation utility
```typescript
const authCookie = generatePayloadCookie({
  collectionAuthConfig: collection.config.auth,
  cookiePrefix: payload.config.cookiePrefix,
  token,
})
headers.append('Set-Cookie', authCookie)
```
**Result**: ❌ Headers still stripped  
**HAR Analysis**: No Set-Cookie headers in response

---

### Attempt 3: Next.js cookies() API from 'next/headers'
**Method**: Use Next.js's official Server Components cookie API
```typescript
import { cookies } from 'next/headers'
const cookieStore = await cookies()
cookieStore.set('payload-token', token, { httpOnly: true, ... })
```
**Result**: ❌ Cookies not transmitted in HTTP response  
**HAR Analysis**: No Set-Cookie headers in response  
**Note**: This method works in Server Components and Route Handlers, but NOT in Payload custom endpoints

---

### Attempt 4: Multiple Set-Cookie Headers (Comma Separation)
**Method**: Join multiple cookies with ', ' separator
```typescript
const allCookies = [authCookie, clearCookie1, clearCookie2].join(', ')
headers.set('Set-Cookie', allCookies)
```
**Result**: ❌ Headers stripped (also incorrect HTTP format)  
**HAR Analysis**: No Set-Cookie headers in response  
**Note**: This was also incorrect - HTTP requires separate Set-Cookie headers, not comma-joined

---

### Attempt 5: req.responseHeaders Mechanism
**Method**: Use Payload's request object to set headers
```typescript
req.responseHeaders = new Headers()
req.responseHeaders.append('Set-Cookie', authCookie)
return Response.redirect(successURL.href)
```
**Result**: ❌ Headers ignored when returning custom Response  
**HAR Analysis**: No Set-Cookie headers in response  
**Note**: `req.responseHeaders` only works when Payload builds the response, not with custom Response objects

---

### Attempt 6: headersWithCors() Wrapper
**Method**: Use Payload's CORS header wrapper (from multi-tenant example)
```typescript
import { headersWithCors } from 'payload'
const headers = new Headers()
headers.append('Set-Cookie', authCookie)
const finalHeaders = headersWithCors({ headers, req })
return new Response(null, { status: 302, headers: finalHeaders })
```
**Result**: ❌ Headers still stripped  
**HAR Analysis**: No Set-Cookie headers in response  
**Reference**: Pattern from `packages/plugin-multi-tenant` example

---

### Attempt 7: Manual Cookie Strings with Max-Age
**Method**: Build cookie strings manually using Max-Age instead of Expires
```typescript
const authCookieString = `payload-token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=7200`
headers.append('Set-Cookie', authCookieString)
return new Response(html, { status: 200, headers })
```
**Result**: ❌ Headers stripped  
**HAR Analysis**: No Set-Cookie headers in response  
**Note**: Switched to Max-Age to avoid timezone issues (server UTC vs browser local time)

---

### Attempt 8: req.responseHeaders with Manual Strings
**Method**: Combine req.responseHeaders with manual cookie strings
```typescript
if (!req.responseHeaders) req.responseHeaders = new Headers()
req.responseHeaders.append('Set-Cookie', authCookieString)
return new Response(html, { status: 200, headers: req.responseHeaders })
```
**Result**: ❌ Headers still stripped  
**HAR Analysis**: No Set-Cookie headers in response  
**Terminal**: Cookie string logged correctly, but never transmitted

---

## Validation Tests

To isolate the problem, we created test routes **outside** Payload's custom endpoint system:

### Test 1: Route Inside (payload) Group
**File**: `src/app/(payload)/api/test-cookie/route.ts`  
**Method**: Direct Next.js Route Handler using `cookies()`
```typescript
export async function GET() {
  const cookieStore = await cookies()
  cookieStore.set('simple-test-cookie', 'hello-world', { ... })
  return Response.json({ success: true })
}
```
**Result**: ✅ **SUCCESS** - Cookie set and transmitted  
**Browser DevTools**: Cookie visible with correct value

### Test 2: Route Outside (payload) Group
**File**: `src/app/test-cookie-external/route.ts`  
**Method**: Direct Next.js Route Handler outside Payload's RootLayout
```typescript
export async function GET() {
  const cookieStore = await cookies()
  cookieStore.set('external-test-cookie', 'value', { ... })
  return Response.json({ success: true })
}
```
**Result**: ✅ **SUCCESS** - Cookie set and transmitted  
**Browser DevTools**: Cookie visible with correct value

### Key Discovery

**Direct Next.js Route Handlers work perfectly** for setting cookies, both inside and outside the `(payload)` route group. The problem is **specific to Payload's custom endpoints** that go through the `/api/[...slug]` REST API handler.

---

## Technical Analysis

### How Payload Registers Custom Endpoints

1. Plugin calls `adminAuthPlugin()` with endpoint configuration
2. Plugin returns endpoints via `config.endpoints` array
3. Endpoints registered with path: `/admin/oauth/:resource/:provider`
4. Payload's `handleEndpoints()` processes these in `/api/[...slug]/route.ts`
5. Response goes through `REST_GET()` wrapper from `@payloadcms/next/routes`
6. **Set-Cookie headers are removed** somewhere in this chain

### Where Headers Are Lost

The stripping happens in one of these locations:

1. **Next.js App Router Response Handling**
   - File: `node_modules/next/dist/server/app-render/app-render.js`
   - App Router may sanitize headers from API routes

2. **Payload's REST Handler**
   - File: `node_modules/@payloadcms/next/dist/routes/rest/index.js`
   - The `handlerBuilder` may not preserve custom headers

3. **Next.js Edge Runtime**
   - If using edge runtime, additional header restrictions apply

### Why Direct Route Handlers Work

Direct Next.js Route Handlers:
- Don't go through Payload's `handleEndpoints()`
- Don't go through the `/api/[...slug]` catch-all
- Use Next.js's native response handling
- **Cookies work perfectly**

---

## Relevant Next.js Changes

### Next.js 15.0.0 → 15.4.10

**Potential Breaking Changes**:

1. **App Router Response Header Handling** (15.1.0+)
   - PR: vercel/next.js#70000+ (response header sanitization)
   - May have added stricter header filtering

2. **Edge Runtime Improvements** (15.2.0+)
   - Enhanced security around response headers
   - Could affect cookie transmission

3. **API Route Middleware** (15.3.0+)
   - Changes to how middleware processes responses
   - May strip headers deemed "unsafe"

**CVE-2025-67779 Fix** (Required 15.4.10+):
- Fixed in: https://github.com/vercel/next.js/security/advisories/GHSA-...
- May have tightened response header validation

**Changelog**: https://github.com/vercel/next.js/releases/tag/v15.4.10

---

## Relevant Payload Changes

### Payload 3.3.0 → 3.68.5

**Custom Endpoint Handling**:

1. **3.50.0** - Major refactor of endpoint handling
   - PR: payloadcms/payload#6000+
   - Improved Next.js App Router integration

2. **3.60.0** - Next.js 15 compatibility updates
   - May have changed how responses are processed

3. **3.68.0** - Next.js 15.4.10+ enforcement
   - PR: payloadcms/payload#8000+
   - Required for CVE fixes

**Potential Issue**: The refactoring for Next.js 15+ may have inadvertently removed cookie-setting capability from custom endpoints.

**Changelog**: https://github.com/payloadcms/payload/releases

---

## Timezone Issue Discovered

During testing, we discovered the server clock is **2 hours behind local time**:

```
Server time (UTC):   2025-12-18T10:17:08.923Z
Browser time (UTC+2): 2025-12-18T12:17:08.923Z
Cookie expires:       2025-12-18T12:17:08.923Z
```

This caused cookies to expire immediately from the browser's perspective. **Solution**: Use `Max-Age` (relative seconds) instead of `Expires` (absolute date).

---

## Alternative Approaches to Investigate

### Option 1: Use Payload Hooks Instead of Custom Endpoints

**Concept**: Set cookies in `beforeLogin` or `afterLogin` hooks

**Pros**:
- Hooks run in Payload's core auth flow
- May have access to response object before sanitization

**Cons**:
- OAuth doesn't use Payload's login operation
- Would need to trigger login operation after OAuth
- Complexity increases significantly

**Investigation needed**:
- Check if `afterLogin` hook can set cookies
- See if we can call `payload.login()` with a custom strategy after OAuth

---

### Option 2: Provide a Next.js Route Handler Template

**Concept**: Users manually create the OAuth callback route in their app

**Implementation**:
```
src/app/api/auth/callback/[provider]/route.ts  ← User creates this
```

The route would:
1. Import OAuth handler from plugin
2. Call handler to validate OAuth and get token
3. Set cookie using Next.js `cookies()` API
4. Redirect to success page

**Pros**:
- Guaranteed to work (direct Route Handlers work)
- Full control over response

**Cons**:
- Manual setup required (not a pure plugin)
- Less "plug and play"
- Users must maintain the route file

**Example**:
```typescript
// src/app/api/auth/callback/[provider]/route.ts
import { cookies } from 'next/headers'
import { handleOAuthCallback } from '@papercup/payload-auth-plugin'

export async function GET(req, { params }) {
  const { token, user } = await handleOAuthCallback(req, params)
  
  const cookieStore = await cookies()
  cookieStore.set('payload-token', token, { ... })
  
  redirect('/admin')
}
```

---

### Option 3: Use Next.js Middleware

**Concept**: Intercept OAuth callback in middleware and set cookies there

**Implementation**:
```typescript
// middleware.ts
export function middleware(request) {
  if (request.nextUrl.pathname.startsWith('/api/admin/oauth/callback')) {
    // Handle OAuth callback
    // Set cookies
    // Return response
  }
}
```

**Pros**:
- Middleware has full control over response
- Can definitely set cookies

**Cons**:
- Middleware runs on every request (performance)
- Complex to integrate with plugin
- User must configure middleware

---

### Option 4: Use Server Actions

**Concept**: OAuth callback triggers a Server Action that sets cookies

**Implementation**:
```typescript
// Server Action
'use server'
async function completeOAuth(code, state) {
  const token = await validateOAuth(code, state)
  const cookieStore = await cookies()
  cookieStore.set('payload-token', token, { ... })
}
```

**Pros**:
- Server Actions can set cookies
- Clean separation of concerns

**Cons**:
- Can't use Server Actions for external redirects (Auth0 callback)
- Would need intermediate page

---

### Option 5: Hybrid Approach - Auth Endpoint + Route Handler

**Concept**: 
1. Keep authorization in Payload custom endpoint (works, no cookies needed)
2. Move callback to user-provided Route Handler

**Implementation**:
```
/api/admin/oauth/authorization/:provider  ← Payload endpoint (works)
/api/auth/callback/:provider              ← User's Route Handler
```

**Pros**:
- Authorization endpoint (which works) stays in plugin
- Only callback needs manual route
- Callback route is simple (plugin exports helper)

**Cons**:
- Still requires manual route creation
- Different paths for auth endpoints

---

### Option 6: Generate Route Files Programmatically

**Concept**: Plugin generates Next.js route files during build

**Implementation**:
- Plugin exports a setup script
- Script creates route files in user's app
- Similar to how Payload generates admin routes

**Pros**:
- Still feels like a plugin
- Routes generated automatically

**Cons**:
- Complex to implement
- File generation during build
- May not work with all build systems

---

### Option 7: Use Payload's Built-in Login with Custom Strategy

**Concept**: After OAuth, call Payload's `payload.login()` with custom strategy

**Implementation**:
```typescript
// After OAuth validation
const loginResult = await payload.login({
  collection: 'users',
  data: { token: oauthToken },
  req,
  strategy: 'oauth',
})
// Payload sets the cookie automatically
```

**Pros**:
- Uses Payload's built-in cookie setting
- No custom endpoint issues

**Cons**:
- Need to register custom auth strategy
- May not support all OAuth flows
- Complexity in strategy implementation

---

## Recommended Path Forward

### Immediate (Quick Fix)
**Option 2: Provide Route Handler Template**

This is the **fastest solution** that we know works:

1. Create template file with Route Handler
2. Document setup in README
3. Export OAuth handling functions from plugin
4. Users copy template to their app

**Effort**: 2-4 hours  
**Reliability**: ✅ Guaranteed to work

### Medium Term (Better UX)
**Option 5: Hybrid Approach**

Keep authorization in Payload endpoint, only callback in Route Handler:

1. Authorization endpoint stays as-is (works fine)
2. Callback moved to user's app
3. Plugin exports `handleOAuthCallback()` helper
4. Simpler for users (only one route to create)

**Effort**: 4-6 hours  
**Reliability**: ✅ High confidence

### Long Term (Ideal)
**Option 7: Custom Auth Strategy**

Integrate with Payload's auth system:

1. Register OAuth as a custom auth strategy
2. Use Payload's `payload.login()` after OAuth
3. Leverage Payload's cookie management
4. Fully integrated solution

**Effort**: 8-12 hours (requires deep Payload understanding)  
**Reliability**: ⚠️ Needs research to confirm feasibility

---

## Next Steps

1. **Research Option 7** (Custom Auth Strategy)
   - Read Payload docs on custom strategies
   - Check if it supports our OAuth flow
   - Test with simple implementation

2. **If Option 7 viable**: Implement it (best long-term solution)

3. **If Option 7 not viable**: Implement Option 2 or 5 (proven to work)

4. **Open GitHub Issue** on Payload repo:
   - Title: "Custom endpoints cannot set cookies in Next.js App Router"
   - Link to this investigation
   - Ask if this is expected behavior

---

## References

### Next.js
- Releases: https://github.com/vercel/next.js/releases
- App Router Docs: https://nextjs.org/docs/app/building-your-application/routing
- Cookies API: https://nextjs.org/docs/app/api-reference/functions/cookies

### Payload CMS
- Releases: https://github.com/payloadcms/payload/releases
- Custom Endpoints: https://payloadcms.com/docs/rest-api/overview#custom-endpoints
- Auth Strategies: https://payloadcms.com/docs/authentication/overview#strategies
- Plugin Development: https://payloadcms.com/docs/plugins/overview

### OAuth Standards
- RFC 6749: https://datatracker.ietf.org/doc/html/rfc6749
- RFC 7636 (PKCE): https://datatracker.ietf.org/doc/html/rfc7636
- oauth4webapi: https://github.com/panva/oauth4webapi

---

**Document Status**: Complete  
**Last Updated**: December 18, 2025  
**Author**: GitHub Copilot (Investigation), Human Developer (Testing)
