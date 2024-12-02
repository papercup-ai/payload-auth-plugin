import type * as oauth from 'oauth4webapi'
import type { OAuth2ProviderConfig, OAuthAccountInfo, ProviderConfig } from '../types'

const authorization_server: oauth.AuthorizationServer = {
  issuer: 'https://auth0.com',
  authorization_endpoint: 'https://papercup-dev.eu.auth0.com/authorize',
  token_endpoint: 'https://papercup-dev.eu.auth0.com/oauth/token',
  userinfo_endpoint: 'https://papercup-dev.eu.auth0.com/userinfo',
}

type Auth0AuthConfig = ProviderConfig

function Auth0AuthProvider(config: Auth0AuthConfig): OAuth2ProviderConfig {
  return {
    ...config,
    id: 'auth0',
    scope: 'openid email profile',
    authorization_server,
    name: 'Auth0',
    algorithm: 'oauth2',
    profile: (profile): OAuthAccountInfo => {
      return {
        sub: profile.id as string,
        name: profile.name as string,
        email: profile.email as string,
        picture: profile.picture as string,
      }
    },
  }
}

export default Auth0AuthProvider
