import type { CollectionConfig, PayloadRequest } from 'payload'

const isAllowedAminAccess = async ({ req } : {req: PayloadRequest}) : Promise<boolean> => { 
  if(!req.user) return false;
  const account = await req.payload.find({
    collection: 'accounts',
    where: {
      user: {
        equals: req.user.id 
      }
    },
    limit: 1
  })
  // if the user does not have an account (ie, its not Auth0 authenticaed), let them in - they've already
  // logged in via username/password
  if(!account.docs.length) return true;
  
  const roles = account.docs[0].roles || []

  return roles.includes('Admin') || 
    roles.includes('SuperUser') || 
    roles.includes('GlossaryAdmin') 

} 

export const Users: CollectionConfig = {
  slug: 'users',
  admin: {
    useAsTitle: 'email',
  },
  auth: true,
  access: {
    admin: isAllowedAminAccess,
  },
  fields: [
    // Email added by default
    // Add more fields as needed
    // {
    //   name: "test",
    //   type: "array",
    //   admin: {
    //     isSortable: false,
    //   },
    //   fields: [
    //     {
    //       name: "role",
    //       type: "text",
    //       hasMany: true,
    //     },
    //   ],
    // }
  ],
}
