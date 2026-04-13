import type { NextFunction, Request, Response } from "express";
import type { UserRole, AuthenticatedUser } from "@kisaanbazar/shared";
import { fail } from "../shared/http.js";
import { env } from "../config/env.js";
import { verifyFirebaseIdToken } from "../config/firebaseAdmin.js";

function parseBearerToken(header?: string): string | null {
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function isRole(value: unknown): value is UserRole {
  return value === "farmer" || value === "buyer" || value === "admin";
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json(fail(req.id, "UNAUTHORIZED", "Missing or invalid bearer token"));
    return;
  }

  if (!env.FIREBASE_AUTH_ENFORCED) {
    req.user = {
      uid: "dev-user",
      role: "buyer"
    };
    next();
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(token);
    const roleClaim = decoded.role;

    if (!isRole(roleClaim)) {
      res.status(403).json(fail(req.id, "FORBIDDEN", "Invalid or missing role claim"));
      return;
    }

    const user: AuthenticatedUser = {
      uid: decoded.uid,
      role: roleClaim
    };

    if (decoded.phone_number) {
      user.phoneNumber = decoded.phone_number;
    }

    if (decoded.email) {
      user.email = decoded.email;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json(fail(req.id, "UNAUTHORIZED", "Token verification failed"));
  }
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json(fail(req.id, "UNAUTHORIZED", "Authentication required"));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json(fail(req.id, "FORBIDDEN", "Insufficient role"));
      return;
    }

    next();
  };
}
