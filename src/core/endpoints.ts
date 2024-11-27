import type { BasePayload, Endpoint, PayloadRequest } from 'payload'
import type { OAuthAccountInfo, OAuthProviderConfig, ProvidersConfig } from '../types'
import { OAuthHandlers } from './routeHandlers/provider'

export class EndpointFactory {
  readonly #providers: Record<string, ProvidersConfig>
  readonly #payloadOAuthPath: string = '/admin/oauth/:resource/:provider'
  // readonly #appAuthPath: string = '/app/:providerType/:resource/:provider'
  constructor(providers: Record<string, ProvidersConfig>) {
    this.#providers = providers
  }
  payloadOAuthEndpoints({
    sessionCallback,
  }: {
    sessionCallback: (
      oauthAccountInfo: OAuthAccountInfo,
      scope: string,
      issuerName: string,
      payload: BasePayload,
    ) => Promise<Response>
  }): Endpoint[] {
    return [
      {
        path: this.#payloadOAuthPath,
        method: 'get',
        handler: (request: PayloadRequest) => {
          const provider = this.#providers[
            request.routeParams?.provider as string
          ] as OAuthProviderConfig

          return OAuthHandlers(
            request,
            request.routeParams?.resource as string,
            provider,
            oauthAccountInfo => {
              return sessionCallback(
                oauthAccountInfo,
                provider.scope,
                provider.name,
                request.payload,
              )
            },
          )
        },
      },
    ]
  }
  //  appAuthEndpoints({
  //    sessionCallback,
  //  }: {
  //    sessionCallback: (
  //      oauthAccountInfo: OAuthAccountInfo,
  //      scope: string,
  //      issuerName: string,
  //      payload: BasePayload,
  //    ) => Promise<Response>
  //  }): Endpoint[] {
  //    return [
  //      {
  //        path: this.#appAuthPath,
  //        method: 'get',
  //        handler: (request: PayloadRequest) => {
  //          const provider = this.#providers[
  //            request.routeParams?.provider as string
  //          ] as OAuthProviderConfig
  //
  //          return OAuthHandlers(
  //            request,
  //            request.routeParams?.resource as string,
  //            provider,
  //            oauthAccountInfo => {
  //              return sessionCallback(
  //                oauthAccountInfo,
  //                provider.scope,
  //                provider.name,
  //                request.payload,
  //              )
  //            },
  //          )
  //        },
  //      },
  //    ]
  //  }
}
