import type { NextFunction, Request, Response } from 'express';
import { ROLES, type Role } from '@cadernin/shared';
import { adminAuth } from '../config/firebase';
import { forbidden, unauthorized } from '../errors';

export type AuthUser = {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  /** Papel vindo do custom claim `role` (null até o usuário escolher o perfil). */
  role: Role | null;
};

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
  }
}

/** Verifica o ID token do Firebase. A identidade vem SÓ do token, nunca do body/headers do front. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw unauthorized('Envie o header Authorization: Bearer <idToken>.');

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const role = ROLES.find((r) => r === decoded.role) ?? null;
    req.user = {
      uid: decoded.uid,
      email: decoded.email ?? null,
      name: (decoded.name as string | undefined) ?? null,
      picture: decoded.picture ?? null,
      role,
    };
  } catch {
    throw unauthorized('Token inválido ou expirado.');
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (!req.user.role || !roles.includes(req.user.role)) throw forbidden('Seu perfil não tem acesso a este recurso.');
    next();
  };
}

/** Atalho tipado para rotas que já passaram por requireAuth. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized();
  return req.user;
}
