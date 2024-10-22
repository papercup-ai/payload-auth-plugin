import type { Config, Plugin } from 'payload'
import { BasePluginConfig } from '../core/base'
import { EndpointFactory } from '../core/endpoints'
import { OAuthProviderConfig } from '../types'
import { PayloadSession } from '../core/session/payload'
import { InvalidBaseURL } from '../core/error'

interface PluginOptions {
  /* Enable or disable plugin
   * @default true
   */
  enabled?: boolean
  /*
   * OAuth Providers
   */
  providers: OAuthProviderConfig[]

  /*
   * Accounts collections slug
   * @default {slug: "accounts"}
   */
  accountsCollection?: {
    slug: string
  }
  /*
   * Users collection slug.
   * @default "users"
   */
  usersCollectionSlug?: string
}

export const adminAuthPlugin =
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

    const { accountsCollection, usersCollectionSlug, providers } = pluginOptions

    const basePluginConfig = new BasePluginConfig(
      providers,
      usersCollectionSlug ?? 'users',
      accountsCollection?.slug ?? 'accounts',
    )

    const session = new PayloadSession({
      accountsCollectionSlug: accountsCollection?.slug ?? 'accounts',
      usersCollectionSlug: usersCollectionSlug ?? 'users',
    })

    const endpoints = new EndpointFactory(basePluginConfig.getProviders())

    // Create accounts collection if doesn't exists
    config.collections = [
      ...(config.collections ?? []),
      basePluginConfig.generateAccountsCollection(),
    ]

    config.endpoints = [
      ...(config.endpoints ?? []),
      ...endpoints.payloadOAuthEndpoints({
        sessionCallback: (oauthAccountInfo, scope, issuerName, basePayload) =>
          session.createSession(oauthAccountInfo, scope, issuerName, basePayload),
      }),
    ]
    return config
  }
