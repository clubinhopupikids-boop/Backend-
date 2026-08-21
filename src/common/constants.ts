export const IS_PUBLIC_KEY = 'isPublic';

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
