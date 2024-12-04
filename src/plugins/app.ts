import type { Config, Plugin } from 'payload'
import { ProvidersConfig } from '../types'
import { InvalidBaseURL } from '../core/error'
import { buildAccountsCollection } from '../core/collections/app/accounts'
import { buildUsersCollection } from '../core/collections/app/users'
import { buildVerificationCollection } from '../core/collections/app/tokens'
import { buildSessionsCollection } from '../core/collections/app/sessions'

interface PluginOptions {
  /* Enable or disable plugin
   * @default true
   */
  enabled?: boolean
  /*
   * Name of your application. This is required to avoid any namespace confilct against Payload.
   * e.g. myFirstApp
   */
  appName: string
  /*
   * OAuth Providers
   */
  providers: ProvidersConfig[]

  /*
  * The group under which to place the accounts collection in the admin UI
  */
  accountsCollectionAdminGroup?: string
}

export const appAuthPlugin =
  (pluginOptions: PluginOptions): Plugin =>
  (incomingConfig: Config): Config => {
    const config = { ...incomingConfig }

    if (pluginOptions.enabled === false) {
      return config
    }

    if (!process.env.AUTH_BASE_URL) {
      throw new InvalidBaseURL()
    }

    config.admin = {
      ...(config.admin ?? {}),
    }

    const { appName } = pluginOptions
    const accountsCollectionSlug = appName + '_accounts'
    const usersCollectionSlug = appName + '_users'
    const sessionsCollectionSlug = appName + '_sessions'
    const verificationsCollectionSlug = appName + '_verifications'
    const accountsCollectionAdminGroup = appName + '_Collections'

    ///   const endpoints = new EndpointFactory(mapProviders(providers))

    config.collections = [
      ...(config.collections ?? []),
      buildAccountsCollection(
        accountsCollectionSlug,
        usersCollectionSlug,
        accountsCollectionAdminGroup,
      ),
      buildUsersCollection(usersCollectionSlug),
      buildVerificationCollection(verificationsCollectionSlug),
      buildSessionsCollection(sessionsCollectionSlug, usersCollectionSlug),
    ]

    config.endpoints = [
      ...(config.endpoints ?? []),
      //     ...endpoints.appAuthEndpoints({
      //       sessionCallback: async () => Response.json({ message: 'Data' }),
      //     }),
    ]
    return config
  }
