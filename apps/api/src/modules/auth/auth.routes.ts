import { Router } from "express";
import type { AuthMeResponse } from "@kisaanbazar/shared";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { ok } from "../../shared/http.js";

export const authRouter = Router();

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
