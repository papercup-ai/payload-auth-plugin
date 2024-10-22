import type { BasePayload, Endpoint, PayloadRequest } from 'payload'
import type { OAuthAccountInfo, OAuthProviderConfig } from '../types'
import { OAuthHandlers } from './routeHandlers/provider'

export class EndpointFactory {
  readonly #providers: Record<string, OAuthProviderConfig>
  readonly #payloadOauthPath: string = '/admin/oauth/:resource/:provider'
  readonly #appOauthPath: string = '/app/oauth/:resource/:provider'
  readonly #appSigninPath: string = '/app/signin/'
  readonly #appSignoutPath: string = '/app/signout/'
  constructor(providers: Record<string, OAuthProviderConfig>) {
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
        path: this.#payloadOauthPath,
        method: 'get',
        handler: (request: PayloadRequest) =>
          OAuthHandlers(
            request,
            request.routeParams?.resource as string,
            this.#providers[request.routeParams?.provider as string],
            oauthAccountInfo =>
              sessionCallback(
                oauthAccountInfo,
                this.#providers[request.routeParams?.provider as string].scope,
                this.#providers[request.routeParams?.provider as string].name,
                request.payload,
              ),
          ),
      },
    ]
  }
  appOAuthEndpoints(): Endpoint[] {
    return [
      {
        path: this.#appOauthPath,
        method: 'get',
        handler: () => {
          return Response.json('')
        },
      },
    ]
  }
  appAuthEndpoints(): Endpoint[] {
    return [
      {
        path: this.#appSigninPath,
        method: 'post',
        handler: () => {
          return Response.json('')
        },
      },
      {
        path: this.#appSignoutPath,
        method: 'post',
        handler: () => {
          return Response.json('')
        },
      },
    ]
  }
}
