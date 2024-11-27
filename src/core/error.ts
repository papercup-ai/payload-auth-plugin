class AuthError extends Error {
  statusCode
  constructor(
    message: string,
    statusCode: 200 | 201 | 301 | 307 | 400 | 401 | 403 | 404 | 409 | 500 | 501,
    cause?: string,
  ) {
    super(message)
    this.name = 'PAYLOAD_AUTH_PLUGIN_ERROR'
    this.message = message
    this.cause = cause
    this.stack = ''
    this.statusCode = statusCode
  }
}
export class InvalidBaseURL extends AuthError {
  constructor() {
    super('Missing or invalid base URL', 500)
  }
}
export class InvalidProvider extends AuthError {
  constructor() {
    super('Invalid Provider', 400)
  }
}

export class ProviderAlreadyExists extends AuthError {
  constructor() {
    super('Duplicate provider found', 409)
  }
}

export class InvalidOAuthAlgorithm extends AuthError {
  constructor() {
    super('Invalid OAuth Algorithm. Plugin only support OIDC and OAuth2 algorithms', 400)
  }
}

export class InvalidOAuthResource extends AuthError {
  constructor() {
    super('Invalid resource request. Check docs before initiating requests', 400)
  }
}

export class MissingOrInvalidSession extends AuthError {
  constructor() {
    super('Missing or invalid session.', 403)
  }
}

export class MissingOrInvalidParams extends AuthError {
  constructor() {
    super('Missing or invalid params', 400)
  }
}

export class AuthenticationFailed extends AuthError {
  constructor() {
    super('Failed to authenticate', 401)
  }
}

export class UserNotFound extends AuthError {
  constructor() {
    super('User not found', 404)
  }
}

export class InvalidCredentials extends AuthError {
  constructor() {
    super('Invalid credentials', 400)
  }
}
