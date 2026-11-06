import { loadLikidHubClubCatalog } from "./likidhub-club-catalog.mjs";
const { summary } = await loadLikidHubClubCatalog();
console.log(JSON.stringify({ mode: "dry-run", writes: 0, ...summary }, null, 2));
