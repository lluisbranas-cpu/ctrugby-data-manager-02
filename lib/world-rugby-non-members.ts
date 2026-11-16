import type { RegionalRugbyAssociation } from "@/lib/regional-rugby-associations";

export type WorldRugbyAffiliation = "miembro" | "no_miembro" | "no_aplica" | "pendiente";

export type NonMemberFederation = {
  id: string;
  name: string;
  country: string;
  regional_association_ids: RegionalRugbyAssociation["id"][];
};

type FederationSeed = Omit<NonMemberFederation, "id" | "name">;

const federationName = (country: string) => `Federación de Rugby de ${country}`;

const seed = (regional_association_ids: RegionalRugbyAssociation["id"][], countries: string[]): FederationSeed[] =>
  countries.map((country) => ({ country, regional_association_ids }));

const nonMemberSeeds = [
  ...seed(["rugby-europe"], ["Bielorrusia", "Estonia", "Islandia", "Kosovo", "Liechtenstein", "Montenegro", "Rusia", "San Marino"]),
  ...seed(["rugby-afrique"], ["Benín", "Chad", "Congo (República del Congo)", "Etiopía", "Gabón", "Guinea", "Libia", "Malaui", "Mozambique", "Níger", "República Centroafricana", "Seychelles", "Sierra Leona", "Sudán"]),
  ...seed(["asia-rugby"], ["Afganistán", "Arabia Saudita", "Bangladés", "Baréin", "Camboya", "Macao", "Omán", "Palestina"]),
  ...seed(["rugby-americas-north"], ["Belice", "Cuba", "Curazao", "Guadalupe", "Guayana Francesa", "Islas Turcas y Caicos", "Martinica"]),
  { country: "República Dominicana", regional_association_ids: ["rugby-americas-north", "sudamerica-rugby"] },
  ...seed(["sudamerica-rugby"], ["Bolivia", "Ecuador", "El Salvador", "Honduras", "Nicaragua"]),
  ...seed(["oceania-rugby"], ["Nauru", "Nueva Caledonia", "Tahití / Polinesia Francesa", "Tuvalu", "Wallis y Futuna"]),
];

export const worldRugbyNonMemberFederations: NonMemberFederation[] = nonMemberSeeds.map((federation, index) => ({
  id: `FN${String(index + 27).padStart(3, "0")}`,
  name: federationName(federation.country),
  ...federation,
}));

const memberCountries: Record<string, RegionalRugbyAssociation["id"][]> = {
  Andorra: ["rugby-europe"], Argentina: ["sudamerica-rugby"], Australia: ["oceania-rugby"],
  "Bélgica": ["rugby-europe"], "Canadá": ["rugby-americas-north"], Chile: ["sudamerica-rugby"],
  Escocia: ["rugby-europe"], España: ["rugby-europe"], "Estados Unidos": ["rugby-americas-north"],
  France: ["rugby-europe"], Francia: ["rugby-europe"], Gales: ["rugby-europe"], Georgia: ["rugby-europe"],
  Inglaterra: ["rugby-europe"], Irlanda: ["rugby-europe"], Italia: ["rugby-europe"], Japón: ["asia-rugby"],
  "Nueva Zelanda": ["oceania-rugby"], "Países Bajos": ["rugby-europe"], Polonia: ["rugby-europe"],
  Portugal: ["rugby-europe"], Rumanía: ["rugby-europe"], Samoa: ["oceania-rugby"], Singapore: ["asia-rugby"],
  Singapur: ["asia-rugby"], "Sudáfrica": ["rugby-afrique"], Suiza: ["rugby-europe"], Tonga: ["oceania-rugby"],
  Uruguay: ["sudamerica-rugby"],
};

export function regionalAssociationIdsForCountry(country: string) {
  return worldRugbyNonMemberFederations.find((federation) => federation.country === country)?.regional_association_ids
    ?? memberCountries[country]
    ?? [];
}

export function nonMemberFederation(id: string) {
  return worldRugbyNonMemberFederations.find((federation) => federation.id === id);
}
