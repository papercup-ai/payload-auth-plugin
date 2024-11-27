import { CollectionConfig } from 'payload'

export function buildSessionsCollection(
  sessionsCollectionSlug: string,
  usersCollectionSlug: string,
) {
  return {
    slug: sessionsCollectionSlug,
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
        name: 'sessionId',
        type: 'text',
        required: true,
      },
      {
        name: 'expiresAt',
        type: 'text',
        required: true,
      },
      {
        name: 'userAgent',
        type: 'text',
        required: true,
      },
      {
        name: 'ipAddress',
        type: 'text',
        required: true,
      },
    ],
  } satisfies CollectionConfig
}
