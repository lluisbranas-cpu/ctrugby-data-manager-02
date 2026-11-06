import { readFile } from "node:fs/promises";
import path from "node:path";
import { applyManualSelectionCallups, readManualSelectionCallups, selectionFederationIds, type SelectionRecord } from "./manual-selection-callups";
import { readHitoPublication, isHitoPublished } from "./hito-publication";
import { callupLinkKey, legacyCallupLinkKey, readCallupLinks, readMilestoneSourceUrls, validSourceUrl } from "./player-callup-links";

export async function publishedCallupSources(playerId: string) {
  const base = path.join(process.cwd(), "data", "staging");
  const [participantsRaw, milestonesRaw, manual, publication, links, sourceUrls] = await Promise.all([
    readFile(path.join(base, "milestone-participants.json"), "utf8"), readFile(path.join(base, "milestones.json"), "utf8"),
    readManualSelectionCallups(), readHitoPublication(), readCallupLinks(playerId), readMilestoneSourceUrls(),
  ]);
  const participants = JSON.parse(participantsRaw) as {id: string; player_id: string | null}[];
  const ids = new Set(participants.filter((item) => item.player_id === playerId).map((item) => item.id));
  const milestones = JSON.parse(milestonesRaw) as {id: string; participant_id: string; scope: string; category: string | null; season_label: string | null; club_text: string | null; position_text: string | null}[];
  const records = milestones.filter((item) => ids.has(item.participant_id)).flatMap((item): SelectionRecord[] => {
    const federation = selectionFederationIds[item.scope]; if (!federation) return [];
    return [{id: item.id, player_id: playerId, player_name: null, federation_id: federation, scope: item.scope, category: item.category, format: null, season_label: item.season_label, club_text: item.club_text, position_text: item.position_text, source: "milestone"}];
  });
  return new Map(applyManualSelectionCallups(records, manual).filter((item) => item.player_id === playerId && isHitoPublished(publication, item.id)).map((item) => {
    const key = callupLinkKey(item);
    return [key, validSourceUrl(links[key]) || validSourceUrl(links[legacyCallupLinkKey(item)]) || sourceUrls.get(item.id) || null];
  }));
}
