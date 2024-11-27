import { CollectionConfig } from 'payload'

export function buildVerificationCollection(verificationCollectionSlug: string) {
  return {
    slug: verificationCollectionSlug,
    access: {
      read: () => true,
      create: () => false,
      update: () => false,
      delete: () => false,
    },
    fields: [
      {
        name: 'refID',
        label: 'Reference ID',
        type: 'text',
        required: true,
      },
      {
        name: 'token',
        type: 'text',
        required: true,
      },
      {
        name: 'expiresAt',
        type: 'text',
        required: true,
      },
    ],
  } satisfies CollectionConfig
}
