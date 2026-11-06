import { PlayerNewsReader } from "./reader";

export default async function PlayerNewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlayerNewsReader playerId={id} />;
}
