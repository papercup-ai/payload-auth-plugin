import { CollectionConfig } from 'payload'
import { OAuthProviderConfig as OAuthProvider } from '../../types'
import { constructAccountsCollection } from './collections'

export class BasePluginConfig {
  readonly #providers: Record<string, OAuthProvider> = {}
  readonly #usersCollectionSlug: string = 'users'
  readonly #accountsCollectionSlug: string = 'accounts'

  constructor(
    providers: OAuthProvider[],
    usersCollectionSlug: string,
    accountsCollectionSlug: string,
  ) {
    this.#providers = providers.reduce(
      (record: Record<string, OAuthProvider>, provider: OAuthProvider) => {
        const newRecord = {
          ...record,
          [provider.id]: provider,
        }
        return newRecord
      },
      {},
    )
    this.#usersCollectionSlug = usersCollectionSlug
    this.#accountsCollectionSlug = accountsCollectionSlug
  }

  generateAccountsCollection(): CollectionConfig {
    return constructAccountsCollection(this.#accountsCollectionSlug, this.#usersCollectionSlug)
  }
  getProviders() {
    return this.#providers
  }
}
