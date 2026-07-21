import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import { useNavigate } from "react-router-dom";

export default function MastersList() {
  const navigate = useNavigate();
  const routes = getEncryptedRoute();
  const base = createCrudRoutePaths(routes.encComplaintTicket, routes.encComplaintMasters);
  const links = [
    ["priorities", "Priorities"],
    ["statuses", "Statuses"],
    ["sources", "Sources"],
    ["teams", "Teams"],
  ];

  return (
    <div className="p-3">
      <h1 className="mb-1 text-3xl font-bold text-gray-800">Complaint Ticket Masters</h1>
      <p className="mb-6 text-sm text-gray-500">Maintain priorities, statuses, sources, and teams.</p>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {links.map(([kind, label]) => (
          <button
            key={kind}
            className="rounded-lg border bg-white p-5 text-left shadow-sm hover:border-green-500"
            onClick={() => navigate(`${base.listPath}/${kind}`)}
          >
            <div className="text-lg font-semibold text-gray-800">{label}</div>
            <div className="mt-1 text-sm text-gray-500">Open {label.toLowerCase()} setup</div>
          </button>
        ))}
      </div>
    </div>
  );
}
