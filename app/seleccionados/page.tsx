import { redirect } from "next/navigation";

export default function SelectedPlayersRedirect() {
  redirect("/jugadores/destacados");
}
