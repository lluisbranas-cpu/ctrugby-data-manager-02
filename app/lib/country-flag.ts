const countryCodes: Record<string, string> = {
  Andorra: "AD", Argentina: "AR", Australia: "AU", Bélgica: "BE", Canada: "CA", Canadá: "CA", Chile: "CL", España: "ES", France: "FR", Francia: "FR", Georgia: "GE", Irlanda: "IE", Italia: "IT", Japón: "JP", "Nueva Zelanda": "NZ", "Países Bajos": "NL", Polonia: "PL", Portugal: "PT", Rumanía: "RO", Samoa: "WS", Singapore: "SG", Singapur: "SG", Sudáfrica: "ZA", Suiza: "CH", Tonga: "TO", Uruguay: "UY", "Estados Unidos": "US", Gales: "GB", Escocia: "GB",
};

export function countryFlagCode(country: string) {
  return countryCodes[country]?.toLocaleLowerCase("en-US") ?? null;
}
