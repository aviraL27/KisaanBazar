export const cacheKeys = {
  listingDetail: (id: string) => `kmb:listing:detail:${id}`,
  listingList: (crop: string, state: string, limit: number) => `kmb:listing:list:${crop}:${state}:${limit}`,
  priceLatest: (crop: string, mandi: string) => `kmb:price:latest:${crop}:${mandi}`
};
