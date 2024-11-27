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
