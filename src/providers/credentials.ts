/**
 * @deprecated WORK IN PROGRESS - NOT YET IMPLEMENTED
 * 
 * Credentials-based authentication provider (email/password).
 * 
 * TODO:
 * - Implement signin callback
 * - Implement signup callback
 * - Add email verification support
 * - Add password reset flow
 * - Add MFA/2FA support (OTP, TOTP)
 * - Add passwordless authentication
 * 
 * Status: Placeholder only - no working implementation.
 * Currently only OAuth/OIDC providers are supported.
 */

import { CredentialsProviderConfig } from '../types'

function CredentialsProvider(): CredentialsProviderConfig {
  return {
    id: 'credentials',
    name: 'Credentials',
    verfiyEmail: false,
    passwordless: false,
    mfa: 'None',
    signinCallback: () => {},
    signupCallback: () => {},
  }
}
export default CredentialsProvider
