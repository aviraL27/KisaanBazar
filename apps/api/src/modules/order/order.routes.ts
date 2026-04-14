import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { listMyOrdersHandler, placeOrderHandler } from "./order.controller.js";

export const orderRouter = Router();

orderRouter.get("/orders/mine", requireAuth, requireRole(["buyer", "admin"]), listMyOrdersHandler);
orderRouter.post("/orders", requireAuth, requireRole(["buyer", "admin"]), placeOrderHandler);
