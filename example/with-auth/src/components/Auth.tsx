import { signin } from '../../../../dist/client'
export const AuthComponent = () => {
  return (
    <form
      action={async () => {
        'use server'
        signin('google')
      }}
      method="GET"
      className="w-full"
    >
      <button type="submit" className="w-full !my-0">
        Sign in with Google
      </button>
    </form>
  )
}
