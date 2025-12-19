
![cover image](https://github.com/user-attachments/assets/ae16c040-1b16-4b93-8cbe-8337ebb0759c)

> **Note: This plugin supports all versions of Payload CMS starting from version 3.0 and above.**

# Authentication plugin for PayloadCMS
This plugin is designed to simplify the integration of multiple Open Authorization (OAuth) and OpenID Connect providers with Payload CMS. Developers can quickly and effortlessly set up authentication mechanisms by leveraging pre-configured providers.

## ⚠️ Important for Version 0.7.0+

If you're upgrading from an earlier version or installing for the first time, please note:

### What Changed
- **Session Management**: Now uses a custom OAuth authentication strategy with `__oauth-session` cookie
- **No Code Changes Required**: The plugin handles authentication automatically - just configure providers as before
- **Security Headers Recommended**: For production deployments, add security headers to your `next.config.mjs` (see [SECURITY.md](./SECURITY.md))

### For Existing Users
Your existing configuration will continue to work. However, for production deployments, we strongly recommend:

1. **Add security headers** to your `next.config.mjs`:
   ```javascript
   const nextConfig = {
     async headers() {
       return [{
         source: '/(.*)',
         headers: [
           {
             key: 'Content-Security-Policy',
             value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; worker-src 'self' blob:",
           },
           { key: 'X-Content-Type-Options', value: 'nosniff' },
           { key: 'X-Frame-Options', value: 'DENY' },
           { key: 'X-XSS-Protection', value: '1; mode=block' },
           { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
         ],
       }]
     },
   }
   ```

2. **Review security documentation**: See [SECURITY.md](./SECURITY.md) for:
   - Why security headers are important
   - Production deployment checklist
   - Security best practices

### For New Users
Follow the installation instructions below - everything works out of the box!

## How it works?
The initial goal in developing this plugin was to abstract its configurations and the resources it utilizes, minimizing the setup required by developers. This way, integrating any supported provider with Payload CMS involves minimal effort.

> There is a scope for future improvements to make every implementation more and more flexible and straightforward

### Authentication Architecture

This plugin uses a **custom OAuth authentication strategy** that establishes persistent sessions via the `__oauth-session` cookie. Here's how the complete flow works:

1. **User initiates OAuth login** → Redirected to provider (Auth0, Google, GitHub, etc.)
2. **Provider authenticates** → Redirects back to `/api/admin/oauth/callback/:provider`
3. **Plugin validates OAuth** → Creates/finds user, generates 2-hour JWT session token
4. **Client-side cookie setting** → HTML page sets `__oauth-session` cookie via JavaScript
5. **Authentication confirmation** → Calls `/api/admin/oauth/login` to verify authentication
6. **Session established** → User redirected to admin panel, stays logged in for 2 hours
7. **Persistent authentication** → OAuth strategy validates cookie on every request

**Session Cookie**: `__oauth-session`
- **Not HttpOnly** (required for client-side setting due to architectural limitation*)
- **2-hour expiration** (matches Payload's default session duration)
- **Signed JWT** (tamper-proof, contains userId, email, collection)
- **SameSite=Lax** (CSRF protection)

*See [COOKIE_INVESTIGATION_REPORT.md](./COOKIE_INVESTIGATION_REPORT.md) for technical details about why server-side cookie setting doesn't work with Payload custom endpoints.

**Security Considerations**:
- While `__oauth-session` is not HttpOnly, it's still secure because:
  - JWT is signed and validated server-side
  - 2-hour expiration limits exposure window
  - SameSite=Lax prevents CSRF attacks
  - XSS attacks would require existing vulnerability in your application
- **Production deployment**: See [SECURITY.md](./SECURITY.md) for:
  - Recommended security headers configuration
  - Detailed risk assessment and mitigations
  - Production security checklist
  - Best practices for OAuth authentication

### Collections
This plugin creates an Accounts collection with the slug `accounts`, which includes all necessary fields. This collection establishes a one-to-one relationship with the Users collection, allowing existing users to sign in with multiple providers. The Accounts collection stores information such as the provider's name and issuer, and it links the account to the user upon first sign-in.

A single user can have multiple accounts, but each account can be associated with only one user.

If you already have a collection with the slug `accounts`, it can cause a conflict and prevent the plugin from integrating successfully. To avoid this issue, make sure to change the slug before integrating this plugin.

### Endpoints
For every provider with different protocols, the endpoints are already configured in the plugin. So any request that comes to the `/api/oauth/**/*` route will be handled by the plugin.

### Signin UI component
The auth signin component is added to the signin page when you integrate the plugin. It can be customized by passing the relevant configuration options.

## Usage

### Install the plugin
```bash
npm install payload-auth-plugin
```
Or
```bash
yarn add payload-auth-plugin
```
Or
```bash
pnpm add payload-auth-plugin
```
### Create an OAuth app
In your desired provider, create an OAuth application. Depending on your provider, you will need to obtain the Client ID and Client Secret from the provider's console or dashboard. Please refer to the [providers list](https://github.com/sourabpramanik/plugin-payload-oauth?tab=readme-ov-file#list-of-active-and-upcoming-providers) for detailed instructions on configuring a specific provider.

For example:
To configure Google OAuth

1. Add the callback/redirect URL:
```bash
https://[yourdomain]/api/oauth/callback/google
```
2. Get the Client ID and Client Secret and set the `.env` variables in your Payload CMS application:
```text
GOOGLE_CLIENT_ID=****************************
GOOGLE_CLIENT_SECRET=****************************
```

### Create a new auth UI component 
Create a new file `/src/components/Auth/index.ts` to sign in with the chosen providers. 
```tsx
import { Button } from '@payloadcms/ui'
import { signin } from 'payload-auth-plugin/client'
export const AuthComponent = () => {
  return (
    <form
      action={async () => {
        'use server'
        signin('google')
      }}
      method="GET"
      className="w-full"
    >
      <Button type="submit" className="w-full !my-0">
        Sign in with Google
      </Button>
    </form>
  )
}
```
Go ahead and customize the component's look and feel to your needs.

### Configure the plugin

Import the plugin in `src/payload.config.ts` and set up a provider:
```typescript

import { buildConfig } from 'payload/config'

// --- rest of the imports

import { adminAuthPlugin } from 'payload-auth-plugin'
import { GoogleAuthProvider } from 'payload-auth-plugin/providers'

export default buildConfig({
  // --- rest of the config
  admin: {
    // --- rest of the admin config
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      afterLogin: ['/components/auth#AuthComponent'],
    },
  }
  plugins: [
  // --- rest of the plugins

    adminAuthPlugin({
      providers: [
        GoogleAuthProvider({
          client_id: process.env.GOOGLE_CLIENT_ID as string,
          client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
        })
      ],
    }),
  ]
})
```

And that's it, now you can run the dev server, and you can now sign in in with Google.

> Checkout [examples](https://github.com/sourabpramanik/payload-auth-plugin/tree/main/example) for better understanding

## Configuration options
Configuration options allow you to extend the plugin to customize the flow and UI based on your requirements. You can explore the available options to understand their purposes and how to use them.

| Options | Description | Default |
| --- | --- | :--: |
| `enabled`: ***boolean*** | Disable or enable plugin | true [OPTIONAL] |
| `providers`: ***array*** | Array of OAuth providers | [REQUIRED] |
| `accountsCollectionSlug`: ***string*** | Accounts collection  | accounts [OPTIONAL] |
| `usersCollectionSlug`: ***string*** | Payload users collection slug | user [OPTIONAL] |

## Open Authorization/OpenID Connect Protocol Based Providers
This plugin includes multiple pre-configured Open Authorization (OAuth) and OpenID Connect protocol-based providers. These configurations streamline the developer experience and integrations, ensuring the authentication process is seamless and uniform across different providers.

To get started, you'll need the Client ID and Client Secret tokens, which can be found in the provider's console/dashboard. Provide these tokens to the plugin's provider settings.

Some providers may require additional domain-specific metadata that cannot be generalized. In such cases, you'll need to provide these specific details as well.

### List of supported providers:

- Google [Doc](https://developers.google.com/identity/protocols/oauth2)
- GitHub [Doc](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps)
- Atlassian [Doc](https://developer.atlassian.com/cloud/confluence/oauth-2-3lo-apps/)
- Discord [Doc](https://discord.com/developers/docs/topics/oauth2)
- Facebook [Doc](https://developers.facebook.com/docs/facebook-login/manually-build-a-login-flow)
- GitLab [Doc](https://docs.gitlab.com/ee/api/oauth2.html)
- Slack [Doc](https://api.slack.com/authentication)
- Auth0 [Doc](https://auth0.com/docs/quickstart/webapp/nextjs/interactive)

## Roadmap
Ordered according to the priority

- Support multiple providers [Feat] ✅
- Add options to customize the sign-in button [Feat] ✅
- Handle errors gracefully [Fix] ✅
- Support magic link [Feat] ⚙
- Support Passkey sign-in [Feat]❓
- Support front-end app authentication [Feat] ⚙

## Troubleshooting

### Authentication fails after OAuth login

**Symptoms**: After OAuth provider authentication, user is redirected back to login page instead of admin panel.

**Possible causes**:
1. **Role restrictions**: If using Auth0 with `expectedRoles` configuration, ensure the user has one of the required roles
2. **Cookie not being set**: Check browser DevTools → Application → Cookies → `__oauth-session` should be present
3. **JWT validation failing**: Check server logs for `[OAuth Strategy]` errors

**Solutions**:
- Verify Auth0 user has correct roles in Auth0 dashboard
- Clear all cookies and try again
- Check that `AUTH_BASE_URL` environment variable matches your actual domain
- Ensure Payload secret is consistent between builds

### Session expires too quickly

**Symptom**: User is logged out after a short time.

**Cause**: The `__oauth-session` cookie has a 2-hour expiration by default.

**Solution**: Currently, session duration is fixed at 2 hours (7200 seconds). To extend this, you would need to modify `OAUTH_SESSION_MAX_AGE` constant in `src/core/auth/oauthStrategy.ts`.

### OAuth strategy logs authentication 3 times per page load

**Symptom**: Server logs show `[OAuth Strategy] Successfully authenticated user:` multiple times.

**This is normal behavior**: Payload authenticates each API request individually:
- `/admin` page render (1st auth)
- `/api/users/me` endpoint (2nd auth)
- `/api/payload-preferences/nav` endpoint (3rd auth)

### Security: Why is `__oauth-session` not HttpOnly?

**Answer**: Due to an architectural limitation in Payload CMS custom endpoints (Set-Cookie headers are stripped), we must set the cookie client-side via JavaScript. This means it cannot be HttpOnly.

**Mitigation**: The cookie is still secure because:
- JWT is cryptographically signed and validated server-side
- 2-hour expiration limits exposure
- SameSite=Lax prevents CSRF
- HTTPS (in production) adds transport encryption

For full technical details, see [COOKIE_INVESTIGATION_REPORT.md](./COOKIE_INVESTIGATION_REPORT.md).

### Cookies not being cleared after logout

**Symptom**: OAuth cookies remain in browser after logout.

**Solution**: Manually clear `__oauth-session`, `__session-code-verifier`, and `__session-oauth-state` cookies, or close the browser (incognito mode).

### Development vs Production differences

**Development** (HTTP localhost):
- `__oauth-session` has `Secure=false`
- Auth0 callback URL: `http://localhost:3000/api/admin/oauth/callback/auth0`

**Production** (HTTPS):
- `__oauth-session` automatically gets `Secure=true` flag
- Auth0 callback URL: `https://yourdomain.com/api/admin/oauth/callback/auth0`
- **Must update callback URL** in Auth0 dashboard for production domain

## Technical Documentation

For developers interested in the implementation details:

- **[SECURITY.md](./SECURITY.md)** - Security considerations, recommended headers, risk assessment, and production checklist
- **[COOKIE_INVESTIGATION_REPORT.md](./COOKIE_INVESTIGATION_REPORT.md)** - Full investigation of the Set-Cookie header limitation (8 failed attempts documented)
- **[ALTERNATIVE_APPROACHES.md](./ALTERNATIVE_APPROACHES.md)** - Analysis of 5 different solution approaches, with rationale for chosen approach
- **[IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md)** - Complete implementation summary with testing results
- **[SESSION_SUMMARY.md](./SESSION_SUMMARY.md)** - Overall session summary with lessons learned

## 🤝 Contributing
If you want to add contributions to this repository, please follow the instructions in [contributing.md](./CONTRIBUTING.md).
