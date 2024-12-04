// storage-adapter-import-placeholder
import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'
import { adminAuthPlugin } from '../../../dist'
import { Auth0AuthProvider } from '../../../dist/providers'

import { Users } from './collections/Users'
import { Media } from './collections/Media'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      afterLogin: ['/components/Auth#AuthComponent'],
    },
  },
  collections: [Users, Media],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    // logger: true,
    idType: 'uuid',
    pool: {
      connectionString: process.env.DATABASE_URI || '',
      ssl: (process.env.DATABASE_SSL || 'true') === 'true' && {rejectUnauthorized: false},
    },
  }),
  sharp,
  plugins: [
    adminAuthPlugin({
      providers: [
        // GoogleAuthProvider({
        //   client_id: process.env.GOOGLE_CLIENT_ID!,
        //   client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        // }),
        Auth0AuthProvider({
          client_id: process.env.AUTH0_CLIENT_ID!,
          client_secret: process.env.AUTH0_CLIENT_SECRET!,
          params: {
            domain: process.env.AUTH0_DOMAIN!,
          },
          authorisation_server: {
            issuer: 'https://papercup-dev.eu.auth0.com/',
            authorization_endpoint: 'https://papercup-dev.eu.auth0.com/authorize',
            token_endpoint: 'https://papercup-dev.eu.auth0.com/oauth/token',
            userinfo_endpoint: 'https://papercup-dev.eu.auth0.com/userinfo',
          },
        }),
      ],
    }),
  ],
})
