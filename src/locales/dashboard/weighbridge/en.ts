export default {
  "weighbridge": {
    "title": "Weighbridge Log",
    "subtitle": "Real-time weight tracking and discrepancy monitoring",
    "refresh": "Refresh",
    "stats": {
      "total_entries": "Total Entries",
      "within_tolerance": "Within Tolerance",
      "minor_deviations": "Minor Deviations",
      "critical_mismatch": "Critical Mismatch"
    },
    "table_title": "Weight Entries Log",
    "table_subtitle": "Real-time weighbridge integration with automatic discrepancy detection",
    "to": "to",
    "headers": {
      "time": "Time",
      "vehicle": "Vehicle",
      "zone": "Zone",
      "expected": "Expected",
      "actual": "Actual",
      "difference": "Difference",
      "status": "Status",
      "action": "Action"
    },
    "status": {
      "normal": "Normal",
      "warning": "Warning",
      "critical": "Critical"
    },
    "action_investigate": "Investigate",
    "action_view": "View",
    "rows_per_page": "Rows per page",
    "page_of": "Page {{page}} of {{totalPages}}",
    "tolerance_title": "Tolerance Settings",
    "tolerance_subtitle": "Current weighbridge tolerance limits and alert thresholds",
    "tolerance_normal_title": "Normal Tolerance",
    "tolerance_normal_desc": "No alerts generated",
    "tolerance_warning_title": "Warning Threshold",
    "tolerance_warning_desc": "Requires verification",
    "tolerance_critical_title": "Critical Threshold",
    "tolerance_critical_desc": "Immediate investigation"
  }
} as const;
