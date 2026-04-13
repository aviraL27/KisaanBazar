import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { DecodedIdToken } from "firebase-admin/auth";
import { env } from "./env.js";

function toPrivateKey(raw: string): string {
  return raw.replace(/\\n/g, "\n");
}

function ensureFirebaseApp() {
  if (getApps().length > 0) {
    return getApp();
  }

  if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
    throw new Error("FIREBASE_NOT_CONFIGURED");
  }

  return initializeApp({
    credential: cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: toPrivateKey(env.FIREBASE_PRIVATE_KEY)
    })
  });
}

export async function verifyFirebaseIdToken(idToken: string): Promise<DecodedIdToken> {
  const app = ensureFirebaseApp();
  const auth = getAuth(app);
  return auth.verifyIdToken(idToken, true);
}
