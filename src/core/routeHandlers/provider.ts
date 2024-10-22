import type { PayloadRequest } from 'payload'
import type { OAuthAccountInfo, OAuthProviderConfig } from '../../types'
import { InvalidOAuthAlgorithm, InvalidOAuthResource, InvalidProvider } from '../error'
import { OIDCAuthorization } from '../protocols/oidc_authorization'
import { OAuth2Authorization } from '../protocols/oauth2_authorization'
import { OIDCCallback } from '../protocols/oidc_callback'
import { OAuth2Callback } from '../protocols/oauth2_callback'

export function OAuthHandlers(
  request: PayloadRequest,
  resource: string,
  provider: OAuthProviderConfig,
  sessionCallBack: (oauthAccountInfo: OAuthAccountInfo) => Promise<Response>,
): Promise<Response> {
  if (!provider) {
    throw new InvalidProvider()
  }

  switch (resource) {
    case 'authorization':
      switch (provider.algorithm) {
        case 'oidc':
          return OIDCAuthorization(provider)
        case 'oauth2':
          return OAuth2Authorization(provider)
        default:
          throw new InvalidOAuthAlgorithm()
      }
    case 'callback':
      switch (provider.algorithm) {
        case 'oidc':
          return OIDCCallback(request, provider, sessionCallBack)
        case 'oauth2':
          return OAuth2Callback(request, provider, sessionCallBack)
        default:
          throw new InvalidOAuthAlgorithm()
      }
    default:
      throw new InvalidOAuthResource()
  }
}
