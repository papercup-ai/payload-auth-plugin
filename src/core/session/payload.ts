import {BasePayload, getCookieExpiration} from 'payload'
import {UserNotFound} from '../error'
import jwt from 'jsonwebtoken'
import {OAuthAccountInfo} from '../../types'
import {generate} from "generate-password";

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
        expectedRoles?: string[]
    ) {
        let userID: string = ''

        // first we check if the user already exists in the users collection
        const findUsersResult = await payload.find({
            collection: this.#collections.usersCollectionSlug,
            where: {
                email: {
                    equals: oauthAccountInfo.email,
                },
            },
        })

        const userFound = findUsersResult.docs.length > 0;
        const auth0AccountInfoHasAnyExpectedRole = oauthAccountInfo.roles && oauthAccountInfo.roles.some((role) => expectedRoles?.includes(role));
        if (userFound) {
            // if the user exists, wee assign the userID to the first user found
            userID = findUsersResult.docs[0].id as string
        } else if (auth0AccountInfoHasAnyExpectedRole) {
            // if the user doesn't exist, we create a new user if the user has an expected role
            const user = await payload.create({
                collection: "users",
                data: {
                    email: oauthAccountInfo.email,
                    password: generate({
                        length: 32,
                        numbers: true,
                        symbols: true,
                        lowercase: true,
                        uppercase: true,
                        strict: true,
                    }),
                },
            });
            userID = user.id as string
        } else {
            // if the user doesn't exist and doesn't have the expected role, we throw an error
            throw new UserNotFound()
        }

        const accounts = await payload.find({
            collection: this.#collections.accountsCollectionSlug,
            where: {
                sub: {equals: oauthAccountInfo.sub},
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
                    roles: oauthAccountInfo.roles,
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
                    roles: oauthAccountInfo.roles,
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
        expectedRoles?: string[]
    ) {
        const userID = await this.#upsertAccount(oauthAccountInfo, scope, issuerName, payload, expectedRoles)

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
        const expired = 'Thu, 01 Jan 1970 00:00:00 GMT'
        cookies.push(`__session-oauth-state=; Path=/; HttpOnly; SameSite=Lax; Expires=${expired}`)
        cookies.push(`__session-oauth-nonce=; Path=/; HttpOnly; SameSite=Lax; Expires=${expired}`)
        cookies.push(`__session-code-verifier=; Path=/; HttpOnly; SameSite=Lax; Expires=${expired}`)
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
