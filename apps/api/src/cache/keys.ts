export const cacheKeys = {
  listingDetail: (id: string) => `kmb:listing:detail:${id}`,
  listingList: (crop: string, state: string) => `kmb:listing:list:${crop}:${state}`
};
