/**
 * @deprecated WORK IN PROGRESS - NOT YET IMPLEMENTED
 * 
 * App-level sessions collection for managing user sessions.
 * Part of the incomplete appAuthPlugin.
 * 
 * TODO:
 * - Implement session creation/validation logic
 * - Add session refresh mechanism
 * - Add session revocation
 * 
 * Status: Collection structure defined but not actively used.
 * Admin authentication uses JWT-based sessions via OAuth strategy.
 */

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
