import type * as oauth from 'oauth4webapi'
import type { OAuth2ProviderConfig, OAuthAccountInfo, ProviderConfig } from '../types'

type Auth0AuthConfig = ProviderConfig & {
  authorisation_server: oauth.AuthorizationServer
  rolesKey: string
}

function Auth0AuthProvider(config: Auth0AuthConfig): OAuth2ProviderConfig {
  return {
    ...config,
    authorization_server: config.authorisation_server,
    id: 'auth0',
    scope: 'openid email profile',
    name: 'Auth0',
    algorithm: 'oauth2',
    profile: (profile): OAuthAccountInfo => {
      return {
        sub: profile.sub as string,
        name: profile.name as string,
        email: profile.email as string,
        picture: profile.picture as string,
        roles: profile[config.rolesKey] as string[],
      }
    },
  }
}

export default Auth0AuthProvider
