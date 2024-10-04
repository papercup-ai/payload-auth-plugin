import type { PayloadRequest } from 'payload'
import * as oauth from 'oauth4webapi'
import type { AccountInfo, OAuth2ProviderConfig } from '../../types'
import { getCallbackURL } from '../utils/cb'
import { parseCookies } from '../utils/cookies'
import { AuthenticationFailed, MissingOrInvalidParams, MissingOrInvalidSession } from '../error'

export async function OAuth2Callback(
  request: PayloadRequest,
  provider: OAuth2ProviderConfig,
  session_callback: (accountInfo: AccountInfo) => Promise<Response>,
): Promise<Response> {
  const parsedCookies = parseCookies(request.headers.get('Cookie')!)

  const code_verifier = parsedCookies['__session-code-verifier']
  const state = parsedCookies['__session-oauth-state']

  if (!code_verifier) {
    throw new MissingOrInvalidSession()
  }

  const client: oauth.Client = {
    client_id: provider.client_id,
    client_secret: provider.client_secret,
    token_endpoint_auth_method: 'client_secret_basic',
  }

  const current_url = new URL(request.url as string)
  const callback_url = getCallbackURL(request)
  const as = provider.authorization_server

  const params = oauth.validateAuthResponse(as, client, current_url, state!)

  if (oauth.isOAuth2Error(params)) {
    throw new MissingOrInvalidParams()
  }

  const response = await oauth.authorizationCodeGrantRequest(
    as,
    client,
    params,
    callback_url.toString(),
    code_verifier,
  )

  const challenges = oauth.parseWwwAuthenticateChallenges(response)

  if (challenges) {
    throw new AuthenticationFailed()
  }

  const token_result = await oauth.processAuthorizationCodeOAuth2Response(as, client, response)
  if (oauth.isOAuth2Error(token_result)) {
    throw new AuthenticationFailed()
  }

  const userInfoResponse = await oauth.userInfoRequest(as, client, token_result.access_token)
  const userInfo = await userInfoResponse.json()
  return session_callback(provider.profile(userInfo))
}
