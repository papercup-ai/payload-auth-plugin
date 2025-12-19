/**
 * @deprecated WORK IN PROGRESS - NOT YET IMPLEMENTED
 * 
 * App-level users collection for frontend authentication.
 * Part of the incomplete appAuthPlugin.
 * 
 * Status: Collection structure defined but not actively used.
 * For admin authentication, Payload's built-in users collection is used.
 */

import { CollectionConfig } from 'payload'
import { z } from 'zod'

export function buildUsersCollection(usersCollectionSlug: string) {
  const usersCollection: CollectionConfig = {
    slug: usersCollectionSlug,
    admin: {
      useAsTitle: 'email',
    },
    fields: [
      {
        name: 'name',
        type: 'text',
      },
      {
        name: 'email',
        type: 'text',
        // @ts-expect-error NOTE:fix the return type
        validate: (val: string) => {
          return Boolean(z.string().email().safeParse(val)) || 'Invalid email'
        },
        required: true,
      },
      {
        name: 'emailVerified',
        type: 'checkbox',
        defaultValue: false,
        required: true,
      },
      {
        name: 'suspended',
        type: 'checkbox',
        defaultValue: false,
      },
    ],
  }
  return usersCollection
}
