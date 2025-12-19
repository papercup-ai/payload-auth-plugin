/**
 * @deprecated WORK IN PROGRESS - NOT YET IMPLEMENTED
 * 
 * App-level verification tokens collection for email verification,
 * password resets, and magic links.
 * Part of the incomplete appAuthPlugin.
 * 
 * TODO:
 * - Implement email verification flow
 * - Add password reset token generation/validation
 * - Add magic link authentication
 * - Add token expiration logic
 * 
 * Status: Collection structure defined but not actively used.
 */

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
