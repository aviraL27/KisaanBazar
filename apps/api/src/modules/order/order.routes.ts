import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { placeOrderHandler } from "./order.controller.js";

export const orderRouter = Router();

orderRouter.post("/orders", requireAuth, requireRole(["buyer", "admin"]), placeOrderHandler);
