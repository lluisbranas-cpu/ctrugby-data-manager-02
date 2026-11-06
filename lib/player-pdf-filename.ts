const madridParts = (date: Date) => Object.fromEntries(
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]),
);

export function playerPdfFilename(playerId: string, downloadedAt = new Date()) {
  const parts = madridParts(downloadedAt);
  return `${playerId.toUpperCase()}-${parts.year}${parts.month}${parts.day}-${parts.hour}${parts.minute}${parts.second}.pdf`;
}
