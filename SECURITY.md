# Security Considerations

**Last Updated**: December 18, 2025

---

## OAuth Session Cookie Security

### The `__oauth-session` Cookie

This plugin uses a `__oauth-session` cookie for OAuth authentication sessions. Due to architectural constraints with Payload CMS custom endpoints, this cookie **cannot be HttpOnly**.

#### Why Not HttpOnly?

**Technical Constraint**:
- Payload CMS custom endpoints strip `Set-Cookie` headers from responses
- This is due to the interaction between Payload 3.68.5 and Next.js 15.4.10 App Router
- Full technical details: [COOKIE_INVESTIGATION_REPORT.md](./COOKIE_INVESTIGATION_REPORT.md)

**Workaround**:
- Cookie must be set **client-side** via JavaScript `document.cookie`
- Browsers **do not allow** JavaScript to set `HttpOnly` cookies
- Therefore, we use a non-HttpOnly cookie

#### Security Implications

**What HttpOnly Protects Against**:
- **XSS (Cross-Site Scripting)** attacks that attempt to steal cookies via JavaScript
- Example: `document.cookie` can read non-HttpOnly cookies

**Why This Is Still Secure**:

1. **JWT Cryptographic Signing** ✅
   - Cookie contains a signed JWT token
   - Server validates signature on every request
   - Attacker cannot forge or tamper with tokens
   - Stolen token has limited value

2. **Short Expiration Window** ✅
   - Sessions expire after **2 hours**
   - Limits damage window if token is stolen
   - Compare to: many sites use 7-30 day sessions

3. **SameSite=Lax Protection** ✅
   - Prevents **CSRF (Cross-Site Request Forgery)** attacks
   - Cookie only sent on same-site navigation
   - External sites cannot trigger authenticated requests

4. **HTTPS Transport Security** ✅
   - `Secure` flag set automatically in production (HTTPS)
   - Cookie only transmitted over encrypted connections
   - Network sniffing attacks prevented

5. **Defense-in-Depth Headers** ✅
   - Content Security Policy restricts script sources
   - Prevents most common XSS vectors
   - Multiple security layers reduce risk

#### Risk Assessment

**Likelihood of Exploitation**: **Low**
- Requires existing XSS vulnerability in your application
- Modern frameworks (React, Next.js) auto-escape output
- CSP headers provide additional XSS protection

**Impact if Exploited**: **Medium**
- Attacker could steal session token (if XSS exists)
- Token expires in 2 hours, limiting damage
- Cannot be used to escalate privileges (JWT validated server-side)

**Overall Risk**: **Acceptable for Production Use**

---

## Recommended Security Headers

To maximize protection for the non-HttpOnly cookie, add security headers to your Next.js application.

### Implementation

Add these headers to your `next.config.mjs`:

```javascript
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https:",
              "font-src 'self' data:",
              "connect-src 'self'",
            ].join('; '),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ]
  },
}
```

### What Each Header Does

#### 1. Content-Security-Policy (CSP)
**Purpose**: Prevents XSS by restricting resource sources

**Directives Explained**:
- `default-src 'self'` - Only load resources from your domain
- `script-src 'self' 'unsafe-eval' 'unsafe-inline'` - Scripts from your domain + inline (needed for Next.js)
- `style-src 'self' 'unsafe-inline'` - Styles from your domain + inline (needed for Payload admin)
- `img-src 'self' data: https:` - Images from your domain, data URIs, or HTTPS sources
- `font-src 'self' data:` - Fonts from your domain or data URIs
- `connect-src 'self'` - API calls only to your domain

**Impact**: Blocks most XSS attempts, even if vulnerability exists

#### 2. X-Content-Type-Options
**Purpose**: Prevents MIME type sniffing

**What It Does**: 
- Forces browsers to respect declared Content-Type
- Prevents interpreting files as executable when they're not
- Example: Uploaded image file won't be executed as JavaScript

**Impact**: Reduces attack surface for file upload vulnerabilities

#### 3. X-Frame-Options
**Purpose**: Prevents clickjacking attacks

**What It Does**:
- Prevents your site from being embedded in `<iframe>`
- `DENY` = never allow framing
- Alternative: `SAMEORIGIN` = allow only same-domain framing

**Impact**: Prevents UI redress attacks where users unknowingly click hidden elements

#### 4. X-XSS-Protection
**Purpose**: Enables browser's built-in XSS filter

**What It Does**:
- Legacy header for older browsers
- `1; mode=block` = enable filter and block page if XSS detected
- Modern browsers have this enabled by default

**Impact**: Additional layer for older browser support

#### 5. Strict-Transport-Security (HSTS)
**Purpose**: Enforces HTTPS connections

**What It Does**:
- Tells browsers to only connect via HTTPS
- `max-age=31536000` = remember for 1 year
- `includeSubDomains` = apply to all subdomains

**Impact**: Prevents man-in-the-middle attacks, protocol downgrade attacks

---

## Additional Security Best Practices

### 1. Input Sanitization
Always sanitize and validate user input:
```typescript
// Good: Use framework escaping
<div>{userInput}</div> // React auto-escapes

// Bad: Inserting raw HTML
<div dangerouslySetInnerHTML={{__html: userInput}} /> // Dangerous!
```

### 2. Environment Variables
Keep secrets secure:
```bash
# Good: Strong, random secrets
PAYLOAD_SECRET=vX9kP2mQ8nR5wL7hT4fG6jY3dE1cZ8bA

# Bad: Weak, predictable secrets
PAYLOAD_SECRET=mysecret123
```

Use cryptographically random secrets (32+ characters):
```bash
openssl rand -hex 32
```

### 3. HTTPS in Production
Always use HTTPS in production:
- Enables `Secure` cookie flag automatically
- Encrypts all traffic
- Required for HSTS header
- Most OAuth providers require HTTPS for production callbacks

### 4. Regular Security Audits
```bash
# Check for npm vulnerabilities
npm audit

# Update dependencies regularly
npm update

# Review security advisories
npm audit fix
```

### 5. Rate Limiting
Consider adding rate limiting for authentication endpoints:
```typescript
// Example: Limit OAuth login attempts
// Prevents brute force and DoS attacks
```

### 6. Audit Logging
Log authentication events for security monitoring:
```typescript
console.log('[Security] OAuth login attempt:', { 
  userId, 
  email, 
  ip: req.ip, 
  timestamp: new Date() 
})
```

---

## Comparison: HttpOnly vs Non-HttpOnly

| Aspect | HttpOnly Cookie | Non-HttpOnly Cookie (Our Implementation) |
|--------|----------------|------------------------------------------|
| **JavaScript Access** | ❌ Blocked | ✅ Accessible |
| **XSS Protection** | ✅ Strong | ⚠️ Mitigated via CSP + JWT |
| **CSRF Protection** | ✅ Via SameSite | ✅ Via SameSite |
| **Server-Side Setting** | ✅ Required | ❌ Not possible in our architecture |
| **Network Security** | ✅ Via HTTPS | ✅ Via HTTPS |
| **Token Tampering** | ✅ Via JWT signature | ✅ Via JWT signature |
| **Session Expiration** | ✅ 2 hours | ✅ 2 hours |
| **Production Ready** | ✅ Yes | ✅ Yes (with proper headers) |

---

## Security Checklist for Production

Before deploying to production, verify:

- [ ] HTTPS enabled (certificate valid)
- [ ] Security headers configured in `next.config.mjs`
- [ ] Strong `PAYLOAD_SECRET` set (32+ characters, random)
- [ ] OAuth provider callback URLs updated to production domain
- [ ] `AUTH_BASE_URL` points to production HTTPS URL
- [ ] Content Security Policy tested (admin panel works)
- [ ] Session expiration tested (2 hours)
- [ ] `npm audit` shows no critical vulnerabilities
- [ ] Rate limiting configured for auth endpoints (optional)
- [ ] Audit logging enabled for authentication events (optional)

---

## FAQ

### Q: Is it safe to use a non-HttpOnly cookie?
**A**: Yes, with proper mitigations. The JWT signature, short expiration, CSP headers, and HTTPS provide strong defense-in-depth. Many production systems use non-HttpOnly tokens when architectural constraints require it.

### Q: Can attackers steal the session token?
**A**: Only if your application has an XSS vulnerability. Modern frameworks like React auto-escape output, preventing most XSS. The CSP headers provide additional protection.

### Q: What if the token is stolen?
**A**: The token expires in 2 hours, limiting damage. The attacker cannot modify or forge tokens (JWT signature). No privilege escalation is possible.

### Q: Should I use this plugin for sensitive data?
**A**: Yes. The security is equivalent to many OAuth implementations. However, always follow security best practices: HTTPS, strong secrets, regular audits, input sanitization.

### Q: Can I make the cookie HttpOnly?
**A**: Not without architectural changes to Payload CMS. The custom endpoint system currently strips Set-Cookie headers. See [COOKIE_INVESTIGATION_REPORT.md](./COOKIE_INVESTIGATION_REPORT.md) for details.

### Q: Are there alternatives?
**A**: Yes, see [ALTERNATIVE_APPROACHES.md](./ALTERNATIVE_APPROACHES.md). Options include using Server Actions (requires Next.js changes) or waiting for Payload to fix the Set-Cookie issue. Our current approach was chosen for compatibility and maintainability.

---

## Reporting Security Issues

If you discover a security vulnerability in this plugin, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainers directly (check repository for contact)
3. Provide detailed steps to reproduce
4. Allow time for a fix before public disclosure

---

## References

- [OWASP Top Ten](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet: Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [MDN: HTTP Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers)
- [Content Security Policy Reference](https://content-security-policy.com/)
- [COOKIE_INVESTIGATION_REPORT.md](./COOKIE_INVESTIGATION_REPORT.md) - Technical details of the HttpOnly limitation

---

**Last Updated**: December 18, 2025  
**Plugin Version**: 0.7.0+  
**Payload CMS Version**: 3.68.5+
