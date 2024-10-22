export function getCallbackURL(appType: 'admin' | 'app', provider: string): URL {
  const callback_url = new URL(process.env.AUTH_BASE_URL as string)
  callback_url.pathname = `/api/${appType}/oauth/callback/${provider}`
  callback_url.search = ''
  return callback_url
}
