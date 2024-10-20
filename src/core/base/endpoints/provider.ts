import type { PayloadRequest } from 'payload'
import type { AccountInfo, EndpointOptions, SessionOptions } from '../../../types'
import {
  OAuth2Authorization,
  OIDCCallback,
  OIDCAuthorization,
  OAuth2Callback,
} from '../../resources'
import { oauth2Session, oidcSession } from '../../session'
import { InvalidOAuthAlgorithm, InvalidOAuthResource, InvalidProvider } from '../../error'

export function GET(
  request: PayloadRequest,
  resource: string,
  providerId: string,
  pluginOptions: EndpointOptions,
): Promise<Response> {
  const provider = pluginOptions.providers[providerId]
  const { providers, ...rest } = pluginOptions
  const sessionOptions: SessionOptions = rest

  if (!provider) {
    throw new InvalidProvider()
  }

  switch (resource) {
    case 'authorization':
      switch (provider.algorithm) {
        case 'oidc':
          return OIDCAuthorization(request, provider)
        case 'oauth2':
          return OAuth2Authorization(request, provider)
        default:
          throw new InvalidOAuthAlgorithm()
      }
    case 'callback':
      switch (provider.algorithm) {
        case 'oidc':
          return OIDCCallback(request, provider, (accountInfo: AccountInfo) =>
            oidcSession(request, provider, sessionOptions, accountInfo),
          )
        case 'oauth2':
          return OAuth2Callback(request, provider, (accountInfo: AccountInfo) =>
            oauth2Session(request, provider, sessionOptions, accountInfo),
          )
        default:
          throw new InvalidOAuthAlgorithm()
      }
    default:
      throw new InvalidOAuthResource()
  }
}
