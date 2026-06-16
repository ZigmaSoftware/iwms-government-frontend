import { useNavigate } from "react-router-dom";
import { getEncryptedRoute } from "@/utils/routeCache";
import { createRoutePath } from "@/utils/routePaths";
import "./workforcemanagement.css";
import { useTranslation } from "react-i18next";

export default function WorkforceManagement() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { encWorkforceManagement, encDateReport, encDayReport } = getEncryptedRoute();
  const reports = [
    { label: t("admin.workforce_management.reports.day"), type: "day" as const },
    { label: t("admin.workforce_management.reports.date"), type: "date" as const },
  ];

  const handleReportClick = (type: "day" | "date") => {
    if (type === "date") {
      navigate(createRoutePath(encWorkforceManagement, encDateReport));
      return;
    }
    navigate(createRoutePath(encWorkforceManagement, encDayReport));
  };

  return (
    <div className="wf-shell">
      <div className="wf-content">
        <div className="wf-left-col">
          <section className="wf-section">
            <h2>{t("admin.workforce_management.reports_title")}</h2>
            <div className="wf-report-grid">
              {reports.map((report) => (
                <article key={report.label} onClick={() => handleReportClick(report.type)}>
                  <span className="icon-report" aria-hidden="true" />
                  <p className="label">{report.label}</p>
                  <p className="cta">{t("admin.workforce_management.reports_cta")}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="wf-section">
            <h2>{t("admin.workforce_management.multimedia_title")}</h2>
            <article className="wf-media-card">
              <span className="icon-media" aria-hidden="true" />
              <div>
                <p className="label">{t("admin.workforce_management.multimedia_plant")}</p>
                <p className="cta">{t("admin.workforce_management.multimedia_live")}</p>
              </div>
            </article>
          </section>

          <footer className="wf-footer">
            {t("admin.workforce_management.footer")}
          </footer>
        </div>

        <div className="wf-right-col">
          <div className="wf-map-card">
            <div className="wf-logo">
              <div className="emblem-circle" />
              <div className="emblem-leaf-green" />
            </div>
            <div className="wf-map">
              <svg viewBox="0 0 400 360" role="presentation">
                <path
                  d="M50 320l20-60 40-30 10-40 45-25 10-30 45-25 40-10 15-40 50-20 30 10 10 45-20 50 10 20 20-5 5 30-25 45-40 15-20 40-35 15-20-5-40 25-30-10-40 20-30-40z"
                  style={{
                    fill: "var(--wf-map-fill)",
                    stroke: "var(--wf-map-stroke)",
                    strokeWidth: 4,
                    strokeLinejoin: "round",
                  }}
                />
                <circle cx="150" cy="160" r="10" style={{ fill: "var(--wf-map-dot)" }} />
              </svg>
            </div>
            <div className="wf-region">
              <p>{t("admin.workforce_management.region_en")}</p>
              <p>{t("admin.workforce_management.region_local")}</p>
            </div>
            <p className="wf-rights">{t("admin.workforce_management.rights")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
