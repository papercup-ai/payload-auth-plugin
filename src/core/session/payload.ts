import {BasePayload} from 'payload'
import {generate} from 'generate-password'
import {UserNotFound} from '../error'
import {OAuthAccountInfo} from '../../types'
import {generateOAuthSessionToken, generateOAuthSessionCookie} from '../auth/oauthStrategy'

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
        const noRoleRestrictions = !expectedRoles || expectedRoles.length === 0;
        const auth0AccountInfoHasAnyExpectedRole = oauthAccountInfo.roles && oauthAccountInfo.roles.some((role) => expectedRoles?.includes(role));
        if (userFound) {
            // if the user exists, wee assign the userID to the first user found
            userID = findUsersResult.docs[0].id as string
        } else if (noRoleRestrictions || auth0AccountInfoHasAnyExpectedRole) {
            // if the user doesn't exist, we create a new user if no role restrictions or user has an expected role
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
        
        // Get user details for the session token
        const user = await payload.findByID({
            collection: this.#collections.usersCollectionSlug,
            id: userID,
        })
        
        if (!user || !user.email) {
            throw new Error('User not found or missing email after OAuth validation')
        }

        // Generate a temporary OAuth session token (JWT, 5 minutes)
        // This will be set as a cookie client-side and used by the OAuth strategy
        const sessionToken = generateOAuthSessionToken(
            userID,
            user.email as string,
            this.#collections.usersCollectionSlug,
            payload.secret
        )

        // Generate the cookie string for client-side setting
        const collection = Object.values(payload.collections).find(
            (coll: any) => coll.config.slug === this.#collections.usersCollectionSlug
        )
        const secure = collection?.config.auth?.cookies?.secure || false
        const sessionCookie = generateOAuthSessionCookie(sessionToken, secure)

        // Build the success URL (where to redirect after setting the cookie)
        const successURL = new URL(process.env.AUTH_BASE_URL as string)
        successURL.pathname = this.#successPath
        successURL.search = ''
        
        // Build the login endpoint URL (will trigger the OAuth strategy and set payload-token)
        const loginURL = new URL(process.env.AUTH_BASE_URL as string)
        loginURL.pathname = '/api/admin/oauth/login'
        loginURL.search = ''

        console.log('[OAuth Session] Generated temporary session token for user:', user.email)
        console.log('[OAuth Session] Will redirect to:', successURL.href)

        // Return HTML that:
        // 1. Sets the temporary OAuth session cookie (client-side)
        // 2. Calls /api/admin/oauth/login to trigger authentication and set payload-token
        // 3. Redirects to the admin panel
        const html = `<!DOCTYPE html>
<html>
<head>
    <title>OAuth Authentication</title>
    <script>
        // Set the temporary OAuth session cookie
        document.cookie = "${sessionCookie}";
        
        // Call the /api/admin/oauth/login endpoint to trigger Payload's authentication
        // This will run the OAuth strategy to authenticate, then manually set
        // the payload-token cookie in the response
        fetch("${loginURL.href}", {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json',
            }
        })
        .then(response => {
            if (response.ok) {
                console.log('Authentication successful, redirecting...');
                // Temporary OAuth flow cookies will be cleared server-side by the endpoint
                
                return response.json().then(data => {
                    console.log('User authenticated:', data);
                    // Redirect to the admin panel
                    window.location.href = "${successURL.href}";
                });
            } else {
                console.error('Authentication failed:', response.status);
                document.getElementById('error').style.display = 'block';
                document.getElementById('error').textContent = 'Authentication failed. Please try again.';
            }
        })
        .catch(error => {
            console.error('Authentication error:', error);
            document.getElementById('error').style.display = 'block';
            document.getElementById('error').textContent = 'Authentication error: ' + error.message;
        });
    </script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
        }
        .container {
            text-align: center;
            padding: 2rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 1rem auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        #error {
            display: none;
            color: #e74c3c;
            margin-top: 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="spinner"></div>    
        <h2>Completing authentication</h2>
        <p id="error"></p>
    </div>
</body>
</html>`

        return new Response(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html',
            },
        })
    }
}
