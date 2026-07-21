import { useLocation, useParams } from "react-router-dom";
import MasterForm from "./MasterForm";
import MasterList from "./MasterList";
import MastersList from "./MastersList";

const isKind = (value: string): value is "priority" | "status" | "source" | "team" =>
  ["priority", "status", "source", "team"].includes(value);

const normalize = (value?: string) => {
  if (!value) return "";
  return value.replace(/s$/, "") as "priority" | "status" | "source" | "team";
};

export default function MastersRouter() {
  const { id } = useParams();
  const location = useLocation();
  const segment = location.pathname.split("/").filter(Boolean).at(-1);
  const previous = location.pathname.split("/").filter(Boolean).at(-2);
  const kind = normalize(id ? previous : segment);

  if (isKind(kind) && (id || location.pathname.endsWith("/new"))) return <MasterForm kind={kind} />;
  if (isKind(kind)) return <MasterList kind={kind} />;
  return <MastersList />;
}
