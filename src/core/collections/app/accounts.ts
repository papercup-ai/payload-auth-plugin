/**
 * @deprecated WORK IN PROGRESS - NOT YET IMPLEMENTED
 * 
 * App-level accounts collection for OAuth/OIDC provider data.
 * Part of the incomplete appAuthPlugin.
 * 
 * Status: Collection structure defined but not actively used.
 * See src/core/collections/admin/accounts.ts for working admin accounts collection.
 */

import { CollectionConfig } from 'payload'

export function buildAccountsCollection(
  accountsCollectionSlug: string,
  usersCollectionSlug: string,
  accountsCollectionAdminGroup: string,
) {
  return {
    slug: accountsCollectionSlug,
    admin: {
      useAsTitle: 'id',
      group: accountsCollectionAdminGroup,
    },
    access: {
      read: ({ req: { user } }) => {
        return Boolean(user)
      },
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    fields: [
      {
        name: 'user',
        type: 'relationship',
        relationTo: usersCollectionSlug,
        hasMany: false,
        required: true,
        label: 'User',
      },
      {
        name: 'provider',
        type: 'text',
        required: true,
      },
      {
        name: 'scope',
        type: 'text',
      },
      {
        name: 'sub',
        type: 'text',
      },
      {
        name: 'accessToken',
        type: 'text',
      },
      {
        name: 'refreshToken',
        type: 'text',
      },
      {
        name: 'password',
        type: 'text',
      },
    ],
  } satisfies CollectionConfig
}
