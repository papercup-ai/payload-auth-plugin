import type { PayloadRequest } from 'payload'
import { BaseAccount, OAuthProviderConfig, OIDCProviderConfig } from '../../../types'

export class PayloadSessionBuilder {
  readonly #payloadRequest: PayloadRequest
  readonly #provideConfig: OAuthProviderConfig | OIDCProviderConfig
  readonly #accountData: BaseAccount

  constructor()
}
