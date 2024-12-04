import { signin } from '../../../../dist/client'
export const AuthComponent = () => {
  return (
    <form
      action={async () => {
        'use server'
        signin('auth0')
      }}
      method="POST"
      className="w-full"
    >
      <button type="submit" className="w-full !my-0">
        Sign in with Auth0
      </button>
    </form>
  )
}
