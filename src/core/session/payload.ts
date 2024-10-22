import { BasePayload, getCookieExpiration } from 'payload'
import { UserNotFound } from '../error'
import jwt from 'jsonwebtoken'
import { OAuthAccountInfo } from '../../types'

type Collections = {
  usersCollectionSlug: string
  accountsCollectionSlug: string
}

export class PayloadSession {
  readonly #collections: Collections
  readonly #successPath: string = '/admin'
  constructor(collections: Collections) {
    this.#collections = collections
  }
  async #upsertAccount(
    oauthAccountInfo: OAuthAccountInfo,
    scope: string,
    issuerName: string,
    payload: BasePayload,
  ) {
    let userID: string = ''

    const user = await payload.find({
      collection: this.#collections.usersCollectionSlug,
      where: {
        email: {
          equals: oauthAccountInfo.email,
        },
      },
    })

    if (user.docs.length === 0) {
      throw new UserNotFound()
    }
    userID = user.docs[0].id as string

    const accounts = await payload.find({
      collection: this.#collections.accountsCollectionSlug,
      where: {
        sub: { equals: oauthAccountInfo.sub },
      },
    })

    if (accounts.docs.length > 0) {
      await payload.update({
        collection: this.#collections.accountsCollectionSlug,
        where: {
          id: {
            equals: accounts.docs[0].id,
          },
        },
        data: {
          scope,
          name: oauthAccountInfo.name,
          picture: oauthAccountInfo.picture,
        },
      })
    } else {
      await payload.create({
        collection: this.#collections.accountsCollectionSlug,
        data: {
          sub: oauthAccountInfo.sub,
          issuerName,
          scope,
          name: oauthAccountInfo.name,
          picture: oauthAccountInfo.picture,
          user: userID,
        },
      })
    }
    return userID
  }
  async createSession(
    oauthAccountInfo: OAuthAccountInfo,
    scope: string,
    issuerName: string,
    payload: BasePayload,
  ) {
    const userID = await this.#upsertAccount(oauthAccountInfo, scope, issuerName, payload)

    const fieldsToSign = {
      id: userID,
      email: oauthAccountInfo.email,
      collection: this.#collections.usersCollectionSlug,
    }

    const cookieExpiration = getCookieExpiration({
      seconds: 7200,
    })

    const token = jwt.sign(fieldsToSign, payload.secret, {
      expiresIn: new Date(cookieExpiration).getTime(),
    })

    const cookies: string[] = []
    cookies.push(
      `${payload.config.cookiePrefix!}-token=${token};Path=/;HttpOnly;SameSite=lax;Expires=${cookieExpiration.toString()}`,
    )
    cookies.push(`__session-oauth-state='';Path=/;HttpOnly;SameSite=lax;Expires=0`)
    cookies.push(`__session-oauth-nonce='';Path=/;HttpOnly;SameSite=lax;Expires=0`)
    cookies.push(`__session-code-verifier='';Path=/;HttpOnly;SameSite=lax;Expires=0`)

    const successURL = new URL(process.env.AUTH_BASE_URL as string)
    successURL.pathname = this.#successPath
    successURL.search = ''

    const res = new Response(null, {
      status: 302,
      headers: {
        Location: successURL.href,
      },
    })

    cookies.forEach(cookie => {
      res.headers.append('Set-Cookie', cookie)
    })

    return res
  }
}
