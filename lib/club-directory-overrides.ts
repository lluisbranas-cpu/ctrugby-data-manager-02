export type ClubTeam = {
  name: string;
  gender: "M" | "F";
  category: string;
  league: string;
  source_url: string;
};

export type ClubDirectoryRecord = {
  id: string;
  name: string;
  active: boolean;
  founded_text: string | null; disappeared_text?: string | null;
  city: string;
  province: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  maps_url: string;
  website: string | null;
  instagram: string | null;
  teams?: ClubTeam[];
};

export const clubDirectoryOverrides: ClubDirectoryRecord[] = [
  {
    id: "ENG0001",
    name: "Richmond Rugby",
    active: true,
    founded_text: "1861",
    city: "Richmond",
    province: "London",
    region: "England",
    country: "England",
    latitude: 51.467,
    longitude: -0.303,
    maps_url: "https://www.google.com/maps/search/?api=1&query=The+Athletic+Ground%2C+Twickenham+Road%2C+Richmond%2C+London+TW9+2SF",
    website: "https://www.richmondfc.co.uk",
    instagram: "@richmondrugby",
    teams: [
      {
        name: "Richmond Men 1st XV",
        gender: "M",
        category: "Men 1st XV",
        league: "Champ Rugby",
        source_url: "https://www.richmondfc.co.uk/teams/238928",
      },
      {
        name: "Richmond Women 1st XV",
        gender: "F",
        category: "Women 1st XV",
        league: "Women's Championship South 1",
        source_url: "https://www.richmondfc.co.uk/teams/254057",
      },
    ],
  },
];

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(?:fc|rfc|rugby|club)\b/gi, "")
    .replace(/[^a-z0-9]+/gi, " ")
    .toLocaleLowerCase("es-ES")
    .trim();

const clubIdentity = (club: Pick<ClubDirectoryRecord, "name" | "city" | "country">) =>
  [normalize(club.name), normalize(club.city), normalize(club.country)].join("|");

function mergeTeams(current: ClubTeam[] = [], incoming: ClubTeam[] = []) {
  const byName = new Map(current.map((team) => [normalize(team.name), team]));
  for (const team of incoming) {
    if (!byName.has(normalize(team.name))) byName.set(normalize(team.name), team);
  }
  return [...byName.values()];
}

export function findClubDirectoryOverride(id: string) {
  return clubDirectoryOverrides.find((club) => club.id === id) ?? null;
}

export function mergeClubDirectoryOverrides<T extends ClubDirectoryRecord>(clubs: T[]) {
  const merged = [...clubs] as Array<T & { teams?: ClubTeam[] }>;
  const byId = new Map(merged.map((club) => [club.id, club]));
  const byIdentity = new Map(merged.map((club) => [clubIdentity(club), club]));

  for (const override of clubDirectoryOverrides) {
    const existing = byId.get(override.id) ?? byIdentity.get(clubIdentity(override));
    if (existing) {
      existing.teams = mergeTeams(existing.teams, override.teams);
      continue;
    }
    merged.push(override as T & { teams?: ClubTeam[] });
  }

  return merged;
}
