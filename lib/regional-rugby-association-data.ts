import { readFile } from "node:fs/promises";
import path from "node:path";
import { regionalRugbyAssociations, type RegionalRugbyAssociation } from "@/lib/regional-rugby-associations";
import { readOperationalDocument } from "@/lib/operational-store";

export const regionalAssociationsDataPath = path.join(process.cwd(), "data", "staging", "regional-rugby-associations.json");

export async function readRegionalRugbyAssociations(): Promise<RegionalRugbyAssociation[]> {
  try {
    const remote = await readOperationalDocument<unknown>("confederation", "regional-associations").catch(() => null);
    const data = remote?.payload ?? JSON.parse(await readFile(regionalAssociationsDataPath, "utf8"));
    if (!Array.isArray(data) || data.length !== 6 || data.some((item) => !/^CR-\d{3}$/.test(item?.code ?? "") || typeof item?.id !== "string" || typeof item?.name !== "string" || !Array.isArray(item?.members))) throw new Error("Formato no válido");
    return data as RegionalRugbyAssociation[];
  } catch { return regionalRugbyAssociations; }
}
