import { PlayerActivityReader } from "../activity-reader";
export default async function Page({params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  return <PlayerActivityReader playerId={id} kind="convocatorias" />;
}
