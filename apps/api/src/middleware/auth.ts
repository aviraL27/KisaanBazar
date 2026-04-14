import type { NextFunction, Request, Response } from "express";
import type { UserRole, AuthenticatedUser } from "@kisaanbazar/shared";
import { fail } from "../shared/http.js";
import { env } from "../config/env.js";
import { verifyFirebaseIdToken } from "../config/firebaseAdmin.js";

const DEV_TOKEN_PREFIX = "kmb-dev";

interface DevTokenPayload {
  uid: string;
  role: UserRole;
  iat: string;
}

function parseCommaSeparated(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

const firebaseAdminEmails = new Set(parseCommaSeparated(env.FIREBASE_ADMIN_EMAILS));
const firebaseFarmerEmails = new Set(parseCommaSeparated(env.FIREBASE_FARMER_EMAILS));

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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

export function issueDevSessionToken(user: { uid: string; role: UserRole }): string {
  const payload: DevTokenPayload = {
    uid: user.uid,
    role: user.role,
    iat: new Date().toISOString()
  };

  return `${DEV_TOKEN_PREFIX}.${toBase64Url(JSON.stringify(payload))}`;
}

function parseDevSessionToken(token: string): { uid: string; role: UserRole } | null {
  if (!token.startsWith(`${DEV_TOKEN_PREFIX}.`)) {
    return null;
  }

  const encoded = token.slice(DEV_TOKEN_PREFIX.length + 1);
  if (!encoded) {
    return null;
  }

  try {
    const decoded = JSON.parse(fromBase64Url(encoded)) as Partial<DevTokenPayload>;
    if (!isNonEmptyString(decoded.uid) || !isRole(decoded.role)) {
      return null;
    }

    return {
      uid: decoded.uid.trim(),
      role: decoded.role
    };
  } catch {
    return null;
  }
}

function parseDevRoleHeader(header: string | string[] | undefined): UserRole {
  const raw = Array.isArray(header) ? header[0] : header;
  if (isRole(raw)) {
    return raw;
  }

  return "buyer";
}

function parseDevUidHeader(header: string | string[] | undefined): string {
  const raw = Array.isArray(header) ? header[0] : header;
  if (isNonEmptyString(raw)) {
    return raw.trim();
  }

  return "dev-user";
}

function resolveRoleForFirebaseUser(params: {
  roleClaim: unknown;
  email: string | undefined;
  devRoleHeader: string | string[] | undefined;
}): UserRole {
  if (isRole(params.roleClaim)) {
    return params.roleClaim;
  }

  if (env.NODE_ENV === "development") {
    return parseDevRoleHeader(params.devRoleHeader);
  }

  const normalizedEmail = params.email?.trim().toLowerCase();
  if (normalizedEmail && firebaseAdminEmails.has(normalizedEmail)) {
    return "admin";
  }

  if (normalizedEmail && firebaseFarmerEmails.has(normalizedEmail)) {
    return "farmer";
  }

  return env.FIREBASE_DEFAULT_ROLE;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = parseBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json(fail(req.id, "UNAUTHORIZED", "Missing or invalid bearer token"));
    return;
  }

  if (!env.FIREBASE_AUTH_ENFORCED) {
    const sessionUser = parseDevSessionToken(token);
    const role = sessionUser?.role ?? parseDevRoleHeader(req.headers["x-dev-role"]);
    const uid = sessionUser?.uid ?? parseDevUidHeader(req.headers["x-dev-uid"]);
    req.user = {
      uid,
      role
    };
    next();
    return;
  }

  try {
    const decoded = await verifyFirebaseIdToken(token);
    const role = resolveRoleForFirebaseUser({
      roleClaim: decoded.role,
      email: decoded.email,
      devRoleHeader: req.headers["x-dev-role"]
    });

    const user: AuthenticatedUser = {
      uid: decoded.uid,
      role
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
