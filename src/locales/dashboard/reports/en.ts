export default {
  "reports": {
    "insights_hub": "Insights Hub",
    "title": "Reports & Analytics",
    "subtitle": "Comprehensive fleet performance and operational reports",
    "range_today": "Today",
    "range_week": "This Week",
    "range_month": "This Month",
    "range_quarter": "This Quarter",
    "kpis": {
      "total_attendance": "Total Attendance",
      "total_attendance_subtext": "+2.4% from last week",
      "fuel_efficiency": "Fuel Efficiency",
      "fuel_efficiency_subtext": "+5.1% improvement",
      "waste_collected": "Waste Collected",
      "waste_collected_subtext": "This month"
    },
    "attendance_report_title": "Attendance Report",
    "attendance_report_subtitle": "Staff attendance and punctuality analysis",
    "attendance_on_time": "On-time arrivals",
    "attendance_late": "Late arrivals (within 30min)",
    "attendance_absent": "Absent/No show",
    "attendance_export": "Export Attendance Report",
    "fuel_trends_title": "Fuel Efficiency Trends",
    "fuel_trends_subtitle": "Fuel consumption analysis by vehicle",
    "fuel_status_excellent": "Excellent",
    "fuel_status_good": "Good",
    "fuel_status_average": "Average",
    "fuel_status_needs_attention": "Needs Attention",
    "daily_summary": {
      "title": "Daily Waste Collection Summary",
      "subtitle": "Waste collection statistics and performance metrics",
      "cards": {
        "total_routes": {
          "label": "Total Routes Completed",
          "value": "142",
          "note": "+12% vs last week"
        },
        "avg_load": {
          "label": "Average Load per Trip",
          "value": "2.8 tons",
          "note": "Within optimal range"
        },
        "efficiency": {
          "label": "Collection Efficiency",
          "value": "94.2%",
          "note": "+3.1% improvement"
        }
      },
      "export_excel": "Export to Excel",
      "export_pdf": "Export to PDF"
    }
  }
} as const;
