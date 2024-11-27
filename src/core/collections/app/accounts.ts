import { CollectionConfig } from 'payload'

export function buildAccountsCollection(
  accountsCollectionSlug: string,
  usersCollectionSlug: string,
) {
  return {
    slug: accountsCollectionSlug,
    admin: {
      useAsTitle: 'id',
    },
    access: {
      read: () => true,
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
