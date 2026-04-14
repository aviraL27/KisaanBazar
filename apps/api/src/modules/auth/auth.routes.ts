import { Router } from "express";
import type {
  AuthDevLoginInput,
  AuthDevLoginResponse,
  AuthFirebasePasswordLoginInput,
  AuthFirebasePasswordLoginResponse,
  AuthMeResponse,
  AuthModeResponse
} from "@kisaanbazar/shared";
import { z } from "zod";
import { env } from "../../config/env.js";
import { verifyFirebaseIdToken } from "../../config/firebaseAdmin.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { issueDevSessionToken } from "../../middleware/auth.js";
import { fail, ok } from "../../shared/http.js";

export const authRouter = Router();

const devLoginSchema = z.object({
  role: z.enum(["buyer", "farmer", "admin"]),
  uid: z.string().trim().min(3).max(64).regex(/^[a-zA-Z0-9_-]+$/)
});

const firebasePasswordLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

authRouter.get("/auth/mode", (req, res) => {
  const payload: AuthModeResponse = {
    firebaseAuthEnforced: env.FIREBASE_AUTH_ENFORCED,
    firebasePasswordLoginEnabled: Boolean(env.FIREBASE_WEB_API_KEY)
  };

  res.status(200).json(ok(req.id, payload));
});

authRouter.post("/auth/dev-login", (req, res) => {
  if (env.FIREBASE_AUTH_ENFORCED) {
    res.status(400).json(fail(req.id, "DEV_LOGIN_DISABLED", "Dev login is disabled when Firebase auth is enforced"));
    return;
  }

  const parsed = devLoginSchema.safeParse(req.body as AuthDevLoginInput);
  if (!parsed.success) {
    res.status(422).json(fail(req.id, "VALIDATION_ERROR", parsed.error.message));
    return;
  }

  const payload: AuthDevLoginResponse = {
    token: issueDevSessionToken({ uid: parsed.data.uid, role: parsed.data.role }),
    user: {
      uid: parsed.data.uid,
      role: parsed.data.role
    }
  };

  res.status(200).json(ok(req.id, payload));
});

authRouter.post("/auth/firebase/password-login", async (req, res) => {
  if (!env.FIREBASE_AUTH_ENFORCED) {
    res.status(400).json(fail(req.id, "FIREBASE_AUTH_DISABLED", "Firebase enforced auth is disabled"));
    return;
  }

  if (!env.FIREBASE_WEB_API_KEY) {
    res.status(503).json(fail(req.id, "FIREBASE_WEB_API_KEY_MISSING", "FIREBASE_WEB_API_KEY is not configured"));
    return;
  }

  const parsed = firebasePasswordLoginSchema.safeParse(req.body as AuthFirebasePasswordLoginInput);
  if (!parsed.success) {
    res.status(422).json(fail(req.id, "VALIDATION_ERROR", parsed.error.message));
    return;
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.FIREBASE_WEB_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: parsed.data.email,
        password: parsed.data.password,
        returnSecureToken: true
      })
    }
  );

  const payload = (await response.json()) as {
    idToken?: string;
    localId?: string;
    expiresIn?: string;
    error?: { message?: string };
  };

  if (!response.ok || !payload.idToken || !payload.localId || !payload.expiresIn) {
    const message = payload.error?.message ?? "Invalid Firebase credentials";
    res.status(401).json(fail(req.id, "INVALID_CREDENTIALS", message));
    return;
  }

  try {
    await verifyFirebaseIdToken(payload.idToken);
  } catch {
    res.status(401).json(fail(req.id, "TOKEN_VERIFICATION_FAILED", "Received invalid Firebase ID token"));
    return;
  }

  const result: AuthFirebasePasswordLoginResponse = {
    token: payload.idToken,
    uid: payload.localId,
    expiresInSec: Number(payload.expiresIn)
  };

  res.status(200).json(ok(req.id, result));
});

authRouter.get("/auth/me", requireAuth, (req, res) => {
  const payload: AuthMeResponse = {
    user: req.user!
  };

  res.status(200).json(ok(req.id, payload));
});

authRouter.get("/auth/farmer-only", requireAuth, requireRole(["farmer", "admin"]), (req, res) => {
  res.status(200).json(
    ok(req.id, {
      message: "Farmer/Admin access granted",
      role: req.user!.role
    })
  );
});
