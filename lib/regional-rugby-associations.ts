export type RegionalRugbyAssociation = {
  code: `CR-${string}`;
  id: string;
  name: string;
  acronym: string;
  territory: string;
  summary: string;
  members: string[];
};

export const regionalRugbyAssociations: RegionalRugbyAssociation[] = [
  { code: "CR-001", id: "rugby-europe", name: "Rugby Europe", acronym: "RE", territory: "Europa", summary: "Asociación regional que coordina las competiciones y el desarrollo del rugby europeo.", members: ["Inglaterra", "Francia", "Irlanda", "Italia", "Escocia", "Gales"] },
  { code: "CR-002", id: "sudamerica-rugby", name: "Sudamérica Rugby", acronym: "SAR", territory: "América del Sur", summary: "Asociación regional que impulsa las competiciones y el desarrollo del rugby sudamericano.", members: ["Argentina", "Uruguay", "Chile", "Brasil"] },
  { code: "CR-003", id: "rugby-americas-north", name: "Rugby Americas North", acronym: "RAN", territory: "América del Norte y el Caribe", summary: "Asociación regional para las federaciones de Norteamérica y el Caribe.", members: ["Estados Unidos", "Canadá", "México", "Naciones del Caribe"] },
  { code: "CR-004", id: "rugby-afrique", name: "Rugby Afrique", acronym: "RA", territory: "África", summary: "Asociación regional que organiza y desarrolla el rugby africano.", members: ["Sudáfrica", "Namibia", "Kenia", "Zimbabue"] },
  { code: "CR-005", id: "asia-rugby", name: "Asia Rugby", acronym: "AR", territory: "Asia", summary: "Asociación regional que administra el desarrollo y los torneos asiáticos.", members: ["Japón", "Hong Kong", "Emiratos Árabes Unidos", "Corea del Sur"] },
  { code: "CR-006", id: "oceania-rugby", name: "Oceania Rugby", acronym: "OR", territory: "Oceanía", summary: "Asociación regional que reúne a las federaciones de Oceanía.", members: ["Nueva Zelanda", "Australia", "Fiyi", "Samoa", "Tonga"] },
];

export function regionalRugbyAssociation(id: string) {
  return regionalRugbyAssociations.find((association) => association.id === id);
}
