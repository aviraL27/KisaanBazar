import { Router } from "express";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import {
  createListingHandler,
  getListingByIdHandler,
  listListingsHandler
} from "./listing.controller.js";

export const listingRouter = Router();

listingRouter.get("/listings", listListingsHandler);
listingRouter.get("/listings/:id", getListingByIdHandler);
listingRouter.post("/listings", requireAuth, requireRole(["farmer", "admin"]), createListingHandler);
