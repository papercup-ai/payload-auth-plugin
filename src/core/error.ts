class AuthError extends Error {
  constructor(message: string, cause?: string) {
    super(message)
    this.name = 'PAYLOAD_AUTH_PLUGIN_ERROR'
    this.message = message
    this.cause = cause
    this.stack = ''
  }
}

export class InvalidProvider extends AuthError {
  constructor() {
    super('Invalid Provider')
  }
}

export class InvalidOAuthAlgorithm extends AuthError {
  constructor() {
    super('Invalid OAuth Algorithm. Plugin only support OIDC and OAuth2 algorithms')
  }
}

export class InvalidOAuthResource extends AuthError {
  constructor() {
    super('Invalid resource request. Check docs before initiating requests')
  }
}

export class MissingOrInvalidSession extends AuthError {
  constructor() {
    super('Missing or invalid session.')
  }
}

export class MissingOrInvalidParams extends AuthError {
  constructor() {
    super('Missing or invalid params')
  }
}

export class AuthenticationFailed extends AuthError {
  constructor() {
    super('Failed to authenticate')
  }
}

export class UserNotFound extends AuthError {
  constructor() {
    super('User not found')
  }
}
