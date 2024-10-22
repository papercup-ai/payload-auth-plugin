import type { PayloadRequest } from 'payload'
import * as oauth from 'oauth4webapi'
import type { OAuthAccountInfo, OIDCProviderConfig } from '../../types'
import { getCallbackURL } from '../utils/cb'
import { parseCookies } from '../utils/cookies'
import { MissingOrInvalidSession } from '../error'

export async function OIDCCallback(
  request: PayloadRequest,
  providerConfig: OIDCProviderConfig,
  session_callback: (oauthAccountInfo: OAuthAccountInfo) => Promise<Response>,
): Promise<Response> {
  const parsedCookies = parseCookies(request.headers.get('Cookie')!)

  const code_verifier = parsedCookies['__session-code-verifier']
  const nonce = parsedCookies['__session-oauth-nonce']

  if (!code_verifier) {
    throw new MissingOrInvalidSession()
  }

  const { client_id, client_secret, issuer, algorithm, profile } = providerConfig
  const client: oauth.Client = {
    client_id,
  }

  const clientAuth = oauth.ClientSecretPost(client_secret)

  const current_url = new URL(request.url as string)
  const callback_url = getCallbackURL('admin', providerConfig.id)
  const issuer_url = new URL(issuer)

  const as = await oauth
    .discoveryRequest(issuer_url, { algorithm })
    .then(response => oauth.processDiscoveryResponse(issuer_url, response))

  const params = oauth.validateAuthResponse(as, client, current_url)

  const response = await oauth.authorizationCodeGrantRequest(
    as,
    client,
    clientAuth,
    params,
    callback_url.toString(),
    code_verifier,
  )

  const token_result = await oauth.processAuthorizationCodeResponse(as, client, response, {
    expectedNonce: nonce as string,
    requireIdToken: true,
  })

  const claims = oauth.getValidatedIdTokenClaims(token_result)!
  const userInfoResponse = await oauth.userInfoRequest(as, client, token_result.access_token)

  const result = await oauth.processUserInfoResponse(as, client, claims.sub, userInfoResponse)

  return session_callback(
    profile({
      sub: result.sub,
      name: result.name as string,
      email: result.email as string,
      picture: result.picture as string,
    }),
  )
}
