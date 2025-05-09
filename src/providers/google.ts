import type { OAuthAccountInfo, OIDCProviderConfig, ProviderConfig } from '../types'

type GoogleAuthConfig = ProviderConfig

function GoogleAuthProvider(config: GoogleAuthConfig): OIDCProviderConfig {
  return {
    ...config,
    id: 'google',
    scope: 'openid email profile',
    issuer: 'https://accounts.google.com',
    name: 'Google',
    algorithm: 'oidc',
    profile: (profile): OAuthAccountInfo => {
      return {
        sub: profile.sub as string,
        name: profile.name as string,
        email: profile.email as string,
        picture: profile.picture as string,
      }
    },
  }
}

export default GoogleAuthProvider
