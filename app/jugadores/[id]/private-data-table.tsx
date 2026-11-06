import type { ReactNode } from "react";
type Field = { label: ReactNode; value: ReactNode; width?: string };
export function PrivateDataTable({ fields }: { fields: Field[] }) {
  return <div className="player-private-table-scroll"><table className="player-private-table"><colgroup>{fields.map((field, index) => <col key={index} style={{ width: field.width }} />)}</colgroup><thead><tr>{fields.map((field, index) => <th scope="col" key={index}>{field.label}</th>)}</tr></thead><tbody><tr>{fields.map((field, index) => <td key={index}>{field.value || "—"}</td>)}</tr></tbody></table></div>;
}
