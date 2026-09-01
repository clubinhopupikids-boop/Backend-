export const IS_PUBLIC_KEY = 'isPublic';
export const REQUIRES_PARENT_ACCESS_KEY = 'requiresParentAccess';
export const PARENT_ACCESS_SCOPE = 'parent_access';
export const PARENT_ACCESS_HEADER = 'x-parent-access-token';

/**
 * JWT payload shape. Keep it minimal — never put secrets or PII here.
 * `sub` is the Responsible id.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

/** Authenticated principal attached to req.user by the JWT strategy. */
export interface AuthenticatedUser {
  id: string; // Responsible id
  email: string;
}

/** Short-lived second-factor ticket. It is never accepted as the main auth JWT. */
export interface ParentAccessTokenPayload {
  sub: string;
  scope: typeof PARENT_ACCESS_SCOPE;
  iat?: number;
  exp?: number;
}
