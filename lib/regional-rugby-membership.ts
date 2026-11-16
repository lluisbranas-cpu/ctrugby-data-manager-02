type MembershipStatus = "Miembro pleno" | "Asociado";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-ES").trim();
const entries = (regionalAssociationId: string, status: MembershipStatus, countries: string[]) => countries.map((country) => [`${regionalAssociationId}:${normalize(country)}`, status] as const);

const membership = new Map<string, MembershipStatus>([
  ...entries("sudamerica-rugby", "Miembro pleno", ["Argentina", "Brasil", "Chile", "Colombia", "Costa Rica", "Paraguay", "Perú", "Uruguay", "Venezuela"]),
  ...entries("sudamerica-rugby", "Asociado", ["Bolivia", "Ecuador", "El Salvador", "Guatemala", "Honduras", "Nicaragua", "Panamá"]),
  ...entries("rugby-americas-north", "Miembro pleno", ["Bahamas", "Barbados", "Bermudas", "Canadá", "Estados Unidos", "Guyana", "Islas Caimán", "Jamaica", "México", "San Vicente y las Granadinas", "Santa Lucía", "Trinidad y Tobago"]),
  ...entries("rugby-americas-north", "Asociado", ["Curazao", "Islas Turcas y Caicos", "Islas Vírgenes Británicas", "República Dominicana"]),
  ...entries("rugby-europe", "Miembro pleno", ["Alemania", "Andorra", "Austria", "Bélgica", "Bosnia y Herzegovina", "Bulgaria", "Chipre", "Croacia", "Dinamarca", "Escocia", "Eslovaquia", "Eslovenia", "España", "Finlandia", "Francia", "France", "Gales", "Georgia", "Grecia", "Hungría", "Inglaterra", "Irlanda", "Israel", "Italia", "Letonia", "Lituania", "Luxemburgo", "Malta", "Moldavia", "Mónaco", "Noruega", "Países Bajos", "Polonia", "Portugal", "República Checa", "Rumanía", "Rusia", "Serbia", "Suecia", "Suiza", "Turquía", "Ucrania"]),
  ...entries("rugby-europe", "Asociado", ["Bielorrusia", "Estonia", "Gibraltar", "Islandia", "Kosovo", "Liechtenstein", "Montenegro", "San Marino"]),
  ...entries("rugby-afrique", "Miembro pleno", ["Argelia", "Botsuana", "Burkina Faso", "Burundi", "Camerún", "Costa de Marfil", "Esuatini", "Ghana", "Kenia", "Madagascar", "Malaui", "Marruecos", "Mauricio", "Namibia", "Nigeria", "República Democrática del Congo", "Ruanda", "Senegal", "Sudáfrica", "Tanzania", "Togo", "Túnez", "Uganda", "Zambia", "Zimbabue"]),
  ...entries("rugby-afrique", "Asociado", ["Benín", "Cabo Verde", "Chad", "Egipto", "Gabón", "Guinea", "Lesoto", "Malí", "Níger", "República del Congo", "Congo (República del Congo)"]),
  ...entries("asia-rugby", "Miembro pleno", ["Arabia Saudita", "Arabia Saudí", "Bangladés", "Brunéi", "Camboya", "Catar", "China", "China Taipéi", "Corea del Sur", "Emiratos Árabes Unidos", "Filipinas", "Guam", "Hong Kong China", "India", "Indonesia", "Irán", "Japón", "Jordania", "Kazajistán", "Kirguistán", "Laos", "Líbano", "Malasia", "Mongolia", "Nepal", "Pakistán", "Singapur", "Singapore", "Sri Lanka", "Tailandia", "Uzbekistán"]),
  ...entries("asia-rugby", "Asociado", ["Afganistán", "Baréin", "Irak", "Macao", "Omán", "Palestina", "Siria"]),
  ...entries("oceania-rugby", "Miembro pleno", ["Australia", "Fiyi", "Islas Cook", "Islas Salomón", "Niue", "Nueva Zelanda", "Papúa Nueva Guinea", "Samoa", "Samoa Americana", "Tahití", "Tahití / Polinesia Francesa", "Tonga", "Vanuatu"]),
  ...entries("oceania-rugby", "Asociado", ["Nauru", "Nueva Caledonia", "Tuvalu", "Wallis y Futuna"]),
]);

const suspendedMemberships = new Set([
  `rugby-europe:${normalize("Rusia")}`,
  `rugby-europe:${normalize("Bielorrusia")}`,
]);

export function regionalMembershipStatus(regionalAssociationId: string | undefined, country: string) {
  return regionalAssociationId ? membership.get(`${regionalAssociationId}:${normalize(country)}`) : undefined;
}

export function regionalMembershipSuspended(
  regionalAssociationId: string | undefined,
  country: string,
) {
  return regionalAssociationId
    ? suspendedMemberships.has(`${regionalAssociationId}:${normalize(country)}`)
    : false;
}
