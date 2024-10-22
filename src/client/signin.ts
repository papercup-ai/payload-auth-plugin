import { redirect } from 'next/navigation'

export function signin(provider: string) {
  redirect('/api/admin/oauth/authorization/' + provider)
}
