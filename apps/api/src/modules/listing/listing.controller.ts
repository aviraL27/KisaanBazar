import type { Request, Response } from "express";
import { fail, ok } from "../../shared/http.js";
import { createListingSchema, listListingQuerySchema } from "./listing.validators.js";
import { createListing, getListingById, listListings } from "./listing.service.js";

export async function createListingHandler(req: Request, res: Response): Promise<void> {
  const parsed = createListingSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(422).json(fail(req.id, "VALIDATION_ERROR", parsed.error.message));
    return;
  }

  if (!req.user) {
    res.status(401).json(fail(req.id, "UNAUTHORIZED", "Authentication required"));
    return;
  }

  const result = await createListing(req.user.uid, parsed.data);
  res.status(201).json(ok(req.id, result));
}

export async function getListingByIdHandler(req: Request, res: Response): Promise<void> {
  const rawId = req.params.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  if (!id) {
    res.status(400).json(fail(req.id, "VALIDATION_ERROR", "Listing id is required"));
    return;
  }

  const result = await getListingById(id);

  if (!result) {
    res.status(404).json(fail(req.id, "NOT_FOUND", "Listing not found"));
    return;
  }

  res.status(200).json(ok(req.id, result));
}

export async function listListingsHandler(req: Request, res: Response): Promise<void> {
  const parsed = listListingQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(422).json(fail(req.id, "VALIDATION_ERROR", parsed.error.message));
    return;
  }

  const filters: { crop?: string | undefined; state?: string | undefined; limit: number } = {
    limit: parsed.data.limit,
    crop: parsed.data.crop,
    state: parsed.data.state
  };

  const result = await listListings(filters);
  res.status(200).json(ok(req.id, result));
}
