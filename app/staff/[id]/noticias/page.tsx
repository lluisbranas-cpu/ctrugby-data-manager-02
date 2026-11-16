import { PlayerNewsReader } from "@/app/jugadores/[id]/noticias/reader";

export default async function StaffNewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PlayerNewsReader playerId={id} subjectType="staff" />;
}
