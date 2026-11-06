const regionalFlagFiles: Record<string, string> = {
  "Andalucía": "Flag of Andalusia.svg",
  "Aragón": "Flag of Aragon.svg",
  "Asturias": "Flag of Asturias.svg",
  "Balears": "Flag of the Balearic Islands.svg",
  "Canarias": "Flag of the Canary Islands.svg",
  "Cantabria": "Flag of Cantabria.svg",
  "Castilla y León": "Flag of Castile and León.svg",
  "Castilla-La Mancha": "Flag of Castile-La Mancha.svg",
  "Catalunya": "Flag of Catalonia.svg",
  "Com. Valenciana": "Flag of the Valencian Community.svg",
  "Euskadi": "Flag of the Basque Country.svg",
  "Extremadura": "Flag of Extremadura.svg",
  "Galicia": "Flag of Galicia.svg",
  "La Rioja": "Flag of La Rioja.svg",
  "Madrid": "Flag of the Community of Madrid.svg",
  "Murcia": "Flag of the Region of Murcia.svg",
  "Navarra": "Flag of Navarre.svg",
};

export function regionalFlagUrl(territory: string) {
  const file = regionalFlagFiles[territory];
  return file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=80` : null;
}
