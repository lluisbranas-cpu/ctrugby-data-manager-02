type Club = { id: string; name: string };
type Participant = { id: string; player_id: string | null };
type Milestone = { participant_id: string; season_label?: string | null; club_text?: string | null; position_text?: string | null };
export type TrajectorySeason = { player_id: string; season_year: number; registration_number?: string | null; club_id: string | null; legacy_club_name: string | null; position_text: string | null; weight_kg: number | null; height_cm: number | null };

const normalize = (value: string | null | undefined) => String(value ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES")
  .replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();

const clubAliases: Record<string, string> = {
  "ar poble nou": "ESP0012",
  "barcelona enginyers rugby": "ESP0012",
  "barcelona enginyers rugby ber": "ESP0012",
  "ber": "ESP0012",
  "ber enginyers": "ESP0012",
  "barca rugby": "ESP0029",
  "buc": "ESP0004",
  "buc ubae": "ESP0004",
  "carboners de terrassa": "ESP0011",
  "castelldefels r u c": "ESP0005",
  "castelldefels ruc": "ESP0005",
  "cau valencia": "ESP0064",
  "c e inef barcelona": "ESP0016",
  "c e inef lleida": "ESP0042",
  "ce inef barcelona": "ESP0016",
  "ce inef lleida": "ESP0042",
  "ceu": "ESP0006",
  "ceu rugby": "ESP0006",
  "cn poble nou": "ESP0012",
  "cn poble nou enginyers": "ESP0012",
  "cn poblenou": "ESP0012",
  "cnpn enginyers": "ESP0012",
  "cr alella": "ESP0010",
  "cr carboners de terrassa": "ESP0011",
  "cr carboneres de terrassa": "ESP0011",
  "cr cervello": "ESP0007",
  "cr sant cugat": "ESP0009",
  "cr spartans": "ESP0008",
  "cr spartans de granollers": "ESP0008",
  "c r tarragona": "ESP0046",
  "cr tarragona": "ESP0046",
  "enginyers poble nou": "ESP0012",
  "f c barcelona": "ESP0029",
  "fc barcelona": "ESP0029",
  "g e i e g": "ESP0040",
  "geieg": "ESP0040",
  "gotics r c": "ESP0015",
  "gotics rc": "ESP0015",
  "inef barcelona": "ESP0016",
  "inef bcn": "ESP0016",
  "inef lleida": "ESP0042",
  "inef leida": "ESP0042",
  "inefc lleida": "ESP0042",
  "manresa rc": "ESP0030",
  "osona rc": "ESP0018",
  "osona rugby club crancs": "ESP0018",
  "osona rugby crancs": "ESP0018",
  "quimic er": "ESP0019",
  "quimic rc": "ESP0019",
  "r c cornella": "ESP0024",
  "r c hospitalet": "ESP0025",
  "r c sitges": "ESP0028",
  "rc badalona": "ESP0023",
  "rc cornella": "ESP0024",
  "rc hospitalet": "ESP0025",
  "rc martorell": "ESP0026",
  "rc mataro": "ESP0027",
  "rc sitges": "ESP0028",
  "rugby cabrera": "ESP0022",
  "spartans de granollers": "ESP0008",
  "spartans granollers": "ESP0008",
  "u e santboiana": "ESP0034",
  "ue santboiana": "ESP0034",
  "vilafranca rc": "ESP0035",
  "vrac quesos entrepinares": "ESP0099",
};

const staleClubAliasCorrections: Record<string, { from: string; to: string | null }> = {
  "ber": { from: "ESP0053", to: "ESP0012" },
  "ber enginyers": { from: "ESP0053", to: "ESP0012" },
  "barcelona enginyers rugby": { from: "ESP0053", to: "ESP0012" },
  "barcelona enginyers rugby ber": { from: "ESP0053", to: "ESP0012" },
  "c e inef lleida": { from: "ESP0044", to: "ESP0042" },
  "ce inef lleida": { from: "ESP0044", to: "ESP0042" },
  "cr tarragona": { from: "ESP0032", to: "ESP0046" },
  "g e i e g": { from: "ESP0045", to: "ESP0040" },
  "geieg": { from: "ESP0045", to: "ESP0040" },
  "inef lleida": { from: "ESP0044", to: "ESP0042" },
  "inefc lleida": { from: "ESP0044", to: "ESP0042" },
  "u e santboiana": { from: "ESP0031", to: "ESP0034" },
  "ue santboiana": { from: "ESP0031", to: "ESP0034" },
  "vilafranca rc": { from: "ESP0033", to: "ESP0035" },
};

const endYearFromLabel = (label: string | null | undefined) => {
  const text = String(label ?? "").trim();
  if (/^Actual\s+a\s+\d{4}-\d{2}-\d{2}$/i.test(text)) return null;
  const years = text.match(/20\d{2}/g)?.map(Number) ?? [];
  const year = Math.max(...years);
  return Number.isInteger(year) && year >= 2000 && year <= 2035 ? year : null;
};

export function resolveMilestoneClubId(clubText: string | null | undefined, clubs: Club[]) {
  const key = normalize(clubText);
  if (!key) return null;
  const exact = new Map(clubs.map((club) => [normalize(club.name), club.id]));
  const alias = clubAliases[key];
  if (alias && clubs.some((club) => club.id === alias)) return alias;
  return exact.get(key) ?? null;
}

export function mergeMilestoneTrajectory(
  seasons: TrajectorySeason[],
  milestones: Milestone[],
  participants: Participant[],
  clubs: Club[],
) {
  const playerByParticipant = new Map(participants.filter((participant) => participant.player_id).map((participant) => [participant.id, participant.player_id!]));
  const merged = new Map(seasons.map((season) => [`${season.player_id}|${season.season_year}`, { ...season }]));
  const added = new Map<string, TrajectorySeason>();
  for (const milestone of milestones) {
    const playerId = playerByParticipant.get(milestone.participant_id);
    const seasonYear = endYearFromLabel(milestone.season_label);
    const clubText = milestone.club_text?.trim();
    if (!playerId || !seasonYear || !clubText) continue;
    const key = `${playerId}|${seasonYear}`;
    const clubId = resolveMilestoneClubId(clubText, clubs);
    const positionText = milestone.position_text?.trim() || null;
    const existing = merged.get(key);
    if (existing) {
      const correction = staleClubAliasCorrections[normalize(clubText)];
      if (existing.club_id && correction?.from === existing.club_id) {
        existing.club_id = correction.to;
        existing.legacy_club_name = correction.to ? null : clubText;
      }
      if (!existing.club_id && !existing.legacy_club_name) {
        existing.club_id = clubId;
        existing.legacy_club_name = clubId ? null : clubText;
      }
      if (!existing.position_text && positionText) existing.position_text = positionText;
      merged.set(key, existing);
      continue;
    }
    if (added.has(key)) continue;
    added.set(key, {
      player_id: playerId,
      season_year: seasonYear,
      registration_number: null,
      club_id: clubId,
      legacy_club_name: clubId ? null : clubText,
      position_text: positionText,
      weight_kg: null,
      height_cm: null,
    });
  }
  return [...merged.values(), ...added.values()];
}

// Profile edits must preserve the same local overlay that the player GET displays.
export function mergeStoredPlayerTrajectory<T extends { season_year: number; player_id?: string }>(remote: T[], stored: T[], playerId: string) {
  const byYear = new Map(remote.map(season => [season.season_year, { ...season, player_id: playerId }]));
  for (const season of stored.filter(season => season.player_id === playerId)) byYear.set(season.season_year, { ...season, player_id: playerId });
  return [...byYear.values()];
}
