import { useEffect, useRef, useState } from "react";
import { useProjectSelector } from "@/contexts/ProjectSelectorContext";
import { Link } from "react-router-dom";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
} from "recharts";
import { DataCard } from "../ui/DataCard";
import { getEncryptedRoute } from "@/utils/routeCache";
import { useTranslation } from "react-i18next";

const API_KEY = "ZIGMA-DELHI-WEIGHMENT-2025-SECURE";

const formatDate = (date: Date) => date.toISOString().split("T")[0];
const parseWeight = (value: unknown) =>
    Number(String(value ?? "0").replace(/,/g, "")) || 0;
const formatTons = (value: number) => value.toFixed(1);

export function WastePieChart() {
    const COLORS = ["#43A047", "#1E88E5", "#FB8C00"]; // Wet, Dry, Mixed
    const { weighmentApiUrl } = useProjectSelector();
    const { encDashboardWasteCollection } = getEncryptedRoute();
    const wasteCollectionPath = `/dashboard/${encDashboardWasteCollection}`;

    const { t } = useTranslation();
    const [data, setData] = useState([
        { key: "wet", value: 0 },
        { key: "dry", value: 0 },
        { key: "mixed", value: 0 },
    ]);

    const labels = {
        wet: t("dashboard.home.waste_wet"),
        dry: t("dashboard.home.waste_dry"),
        mixed: t("dashboard.home.waste_mixed"),
    };

    const chartData = data.map((item) => ({
        ...item,
        name: labels[item.key as keyof typeof labels],
    }));

    const total = data.reduce((sum, i) => sum + i.value, 0);
    const fallbackAppliedRef = useRef(false);

    // API + FALLBACK (yesterday if no data for today)
    useEffect(() => {
        const controller = new AbortController();
        async function loadData(dateParam: string, allowFallback: boolean) {
            if (!weighmentApiUrl) {
                setData([{ key: "wet", value: 0 }, { key: "dry", value: 0 }, { key: "mixed", value: 0 }]);
                return;
            }
            try {
                const url =
                    `${weighmentApiUrl}?action=day_wise_data&from_date=${dateParam}&to_date=${dateParam}&key=${API_KEY}`;

                const res = await fetch(url, { signal: controller.signal });
                const json = await res.json();
                console.log("WastePieChart - fetched data:", json);

                const rows = Array.isArray(json?.data) ? json.data : [];
                if (!rows.length) {
                    if (allowFallback && !fallbackAppliedRef.current) {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        fallbackAppliedRef.current = true;
                        await loadData(formatDate(yesterday), false);
                        return;
                    }
                    setData([
                        { key: "wet", value: 0 },
                        { key: "dry", value: 0 },
                        { key: "mixed", value: 0 },
                    ]);
                    return;
                }

                const totals = rows.reduce(
                    (acc: { wet: number; dry: number; mix: number }, row: any) => {
                        acc.wet += parseWeight(row.Wet_Wt);
                        acc.dry += parseWeight(row.Dry_Wt);
                        acc.mix += parseWeight(row.Mix_Wt);
                        return acc;
                    },
                    { wet: 0, dry: 0, mix: 0 }
                );

                setData([
                    { key: "wet", value: totals.wet / 1000 },
                    { key: "dry", value: totals.dry / 1000 },
                    { key: "mixed", value: totals.mix / 1000 },
                ]);
            } catch (error) {
                if ((error as { name?: string })?.name === "AbortError") {
                    return;
                }
                setData([
                    { key: "wet", value: 0 },
                    { key: "dry", value: 0 },
                    { key: "mixed", value: 0 },
                ]);
            }
        }

        const today = formatDate(new Date());
        loadData(today, true);
        return () => controller.abort();
    }, [weighmentApiUrl]);

    const CustomTooltip = ({ active, payload }: any) => {
        if (!active || !payload || !payload.length) return null;

        const item = payload[0];

        return (
            <div className="relative">
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs shadow-lg px-3 py-2 rounded-md">
                    <div className="font-semibold text-gray-800 dark:text-gray-200">
                        {item.name}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                        {formatTons(item.value)} {t("common.tons")} (
                        {total ? ((item.value / total) * 100).toFixed(1) : "0.0"}%)
                    </div>
                </div>

                <div className="absolute left-1/2 -bottom-2 transform -translate-x-1/2 
                                w-0 h-0 border-l-6 border-r-6 border-t-8 
                                border-l-transparent border-r-transparent 
                                border-t-white dark:border-t-gray-800"></div>
            </div>
        );
    };

    return (
        <DataCard
            title={t("dashboard.home.daily_waste_collection_title")}
            compact
            accent="brand-primary"
            icon={<span className="text-green-500 text-base leading-none">♻</span>}
            action={
                <Link
                    to={wasteCollectionPath}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                    {t("common.view_all")}
                </Link>
            }
        >
            <div className="w-full h-48 relative flex">

                {/* PIE CHART */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="relative w-full h-36 md:h-40">

                        <ResponsiveContainer>
                            <PieChart>
                                <Pie
                                    data={chartData}
                                    dataKey="value"
                                    innerRadius={45}
                                    outerRadius={70}
                                    strokeWidth={0}
                                    paddingAngle={3}
                                >
                                    {chartData.map((_, i) => (
                                        <Cell key={i} fill={COLORS[i]} />
                                    ))}
                                </Pie>

                                <Tooltip content={<CustomTooltip />} />
                            </PieChart>
                        </ResponsiveContainer>

                        {/* TOTAL */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-lg font-bold text-gray-800 dark:text-gray-200">
                                {formatTons(total)}
                            </span>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                {t("dashboard.home.total_unit_label", { unit: t("common.tons") })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* KPI RIGHT */}   
                <div className="w-32 flex flex-col justify-center pl-3 gap-2">
                    {chartData.map((item, i) => (
                        <div
                            key={i}
                            className="p-2 rounded-md border border-gray-200 dark:border-gray-700"
                            style={{
                                backgroundColor:
                                    i === 0 ? "rgba(67,160,71,0.12)" :       // Wet (Green)
                                    i === 1 ? "rgba(30,136,229,0.12)" :       // Dry (Blue)
                                            "rgba(251,140,0,0.12)",          // Mixed (Orange)
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <span
                                    className="w-3 h-3 rounded-full"
                                    style={{ backgroundColor: COLORS[i] }}
                                ></span>

                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                    {item.name}
                                </span>
                            </div>

                            <div className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-1">
                                {formatTons(item.value)} {t("common.tons")}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </DataCard>
    );
}
