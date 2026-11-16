type Group = { association: string; countries: string[] };
const groups: Group[] = [
  { association: "sudamerica-rugby", countries: ["Brasil", "Colombia", "Costa Rica", "Paraguay", "Perú", "Venezuela", "Guatemala", "Panamá"] },
  { association: "rugby-americas-north", countries: ["Bahamas", "Barbados", "Bermudas", "Guyana", "Islas Caimán", "Jamaica", "México", "San Vicente y las Granadinas", "Santa Lucía", "Trinidad y Tobago", "Islas Vírgenes Británicas"] },
  { association: "rugby-europe", countries: ["Alemania", "Austria", "Bosnia y Herzegovina", "Bulgaria", "Chipre", "Croacia", "Dinamarca", "Eslovaquia", "Eslovenia", "Finlandia", "Grecia", "Hungría", "Inglaterra", "Israel", "Letonia", "Lituania", "Luxemburgo", "Malta", "Moldavia", "Mónaco", "Noruega", "República Checa", "Serbia", "Suecia", "Turquía", "Ucrania", "Gibraltar"] },
  { association: "rugby-afrique", countries: ["Argelia", "Botsuana", "Burkina Faso", "Burundi", "Camerún", "Costa de Marfil", "Esuatini", "Ghana", "Kenia", "Madagascar", "Marruecos", "Mauricio", "Namibia", "Nigeria", "República Democrática del Congo", "Ruanda", "Senegal", "Tanzania", "Togo", "Túnez", "Uganda", "Zambia", "Zimbabue", "Cabo Verde", "Egipto", "Lesoto", "Malí"] },
  { association: "asia-rugby", countries: ["Brunéi", "Catar", "China", "China Taipéi", "Corea del Sur", "Emiratos Árabes Unidos", "Filipinas", "Guam", "Hong Kong China", "India", "Indonesia", "Irán", "Jordania", "Kazajistán", "Kirguistán", "Laos", "Líbano", "Malasia", "Mongolia", "Nepal", "Pakistán", "Sri Lanka", "Tailandia", "Uzbekistán", "Irak", "Siria"] },
  { association: "oceania-rugby", countries: ["Islas Cook", "Islas Salomón", "Niue", "Papúa Nueva Guinea", "Samoa Americana", "Vanuatu"] },
];

export const missingRegionalFederations = groups.flatMap((group) => group.countries.map((country) => ({ country, regional_association_ids: [group.association] }))).map((federation, index) => ({
  ...federation, id: `FN${String(index + 75).padStart(3, "0")}`, name: `Federación de Rugby de ${federation.country}`, scope: "Nacional", territory: federation.country, active: true, website: null, published: true, version: 0, world_rugby_affiliation: "pendiente" as const,
}));
