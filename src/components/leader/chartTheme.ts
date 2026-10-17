import { createContext, useContext } from "react";
import { BRAND } from "@/components/maps/leaderMapTheme";

/* single-series accent for the leader dashboards' charts (trend bars and
   area, ranking bars, loading spinner). The state portal keeps the brand
   violet; the district portal wraps its page in a provider with its sky
   blue so its analytics match its map. */
export const ChartAccent = createContext<string>(BRAND);
export const useChartAccent = () => useContext(ChartAccent);
