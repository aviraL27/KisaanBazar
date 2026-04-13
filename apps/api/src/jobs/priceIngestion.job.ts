import type { ManualIngestPriceInput } from "@kisaanbazar/shared";
import { ingestPricesManually } from "../modules/price/price.service.js";

export async function runPriceIngestionJob(input: ManualIngestPriceInput[]): Promise<{ insertedCount: number }> {
  return ingestPricesManually(input);
}
