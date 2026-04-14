import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  createListingHandler,
  getListingByIdHandler,
  listListingsHandler,
  listMyListingsHandler,
  updateListingStatusHandler
} from "./listing.controller.js";

export const listingRouter = Router();

listingRouter.get("/listings", listListingsHandler);
listingRouter.get("/listings/mine", requireAuth, requireRole(["farmer", "admin"]), listMyListingsHandler);
listingRouter.patch("/listings/:id/status", requireAuth, requireRole(["farmer", "admin"]), updateListingStatusHandler);
listingRouter.get("/listings/:id", getListingByIdHandler);
listingRouter.post("/listings", requireAuth, requireRole(["farmer", "admin"]), createListingHandler);
