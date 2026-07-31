import { useNavigate } from "react-router-dom";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createCrudRoutePaths } from "@/utils/routePaths";
import MasterList from "./MasterList";
import { MASTER_CONFIG, REFERENCE_DATA_KINDS, type MasterKind } from "./masterConfig";

type Props = {
  /** Which of the 4 merged kinds this route landed on. */
  kind: (typeof REFERENCE_DATA_KINDS)[number];
};

/**
 * "Reference Data" — one screen standing in for what used to be 4 separate
 * sidebar items (Modules, Priorities, Sources, Statuses). Each of those 4 is
 * a near-identical Code+Name(+flags) master with no relationships of its own,
 * so rather than 4 pages a user has to know to visit separately, they're tabs
 * on one page.
 *
 * The 4 underlying routes (`modules`, `priorities`, `sources`, `statuses`)
 * are untouched — this screen IS each of their `list` components now (see
 * `ModuleList.tsx` etc.), so bookmarked URLs, the Add/Edit routes, and the
 * back-compat alias map in `AdminEncryptedRouter.tsx` all keep working
 * unmodified. Switching tabs just navigates to the sibling kind's own list
 * route; only the sidebar collapsed from 4 entries to this 1.
 */
export default function ReferenceDataScreen({ kind }: Props) {
  const navigate = useNavigate();
  const routes = getEncryptedRoute();

  const tabPath = (target: MasterKind) => {
    const config = MASTER_CONFIG[target];
    return createCrudRoutePaths(routes.encComplaintTicket, routes[config.routeKey]).listPath;
  };

  return (
    <div>
      <div className="mb-1 flex flex-wrap gap-2 px-3 pt-3">
        {REFERENCE_DATA_KINDS.map((tabKind) => {
          const active = tabKind === kind;
          return (
            <button
              key={tabKind}
              type="button"
              onClick={() => !active && navigate(tabPath(tabKind))}
              className={
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors " +
                (active
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200")
              }
            >
              {MASTER_CONFIG[tabKind].titlePlural}
            </button>
          );
        })}
      </div>
      <MasterList kind={kind} />
    </div>
  );
}
