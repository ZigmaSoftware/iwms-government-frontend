export default {
  "reports": {
    "waste_summary": {
      "title": "Waste Collected Summary",
      "subtitle": "Month-wise waste collection analytics",
      "search_placeholder": "Search waste summary...",
      "empty_message": "No waste data found.",
      "export_sheet": "Waste Summary",
      "export_file_prefix": "waste-summary",
      "columns": {
        "s_no": "S.No",
        "date": "Date",
        "total_household": "Total Household",
        "collected": "Collected",
        "not_collected": "Not Collected",
        "vehicle_count": "No. of Vehicle",
        "trip_count": "No. of Trip",
        "dry_weight": "Dry Wt/kg",
        "wet_weight": "Wet Wt/kg",
        "mixed_weight": "Mixed Wt/kg",
        "weighment": "Weighment/kg",
        "avg_per_trip": "Avg / Trip"
      }
    },
    "monthly_distance": {
      "title": "Monthly Distance",
      "search_placeholder": "Search vehicle...",
      "error_fallback": "Using fallback vehicles",
      "error_unavailable": "Vehicle roster unavailable",
      "error_partial": "Some vehicles failed to load",
      "loading_vehicles": "Loading vehicles...",
      "loading_distances": "Loading distance data...",
      "loaded_vehicles": "Vehicles loaded: {{count}}",
      "export_sheet": "Monthly Distance",
      "export_file_prefix": "monthly-distance",
      "columns": {
        "index": "#",
        "vehicle_id": "Vehicle ID",
        "total": "Total"
      }
    },
    "trip_summary": {
      "title": "Trip Summary",
      "export_sheet": "Trip Summary",
      "filters": {
        "vehicle_id": "Vehicle ID",
        "from_date": "From Date",
        "to_date": "To Date"
      },
      "roster_no_live": "No live vehicles. Showing fallback vehicles.",
      "roster_unavailable": "Live vehicle list unavailable. Using fallback list.",
      "error_select_vehicle": "Please choose a vehicle.",
      "error_invalid_range": "Invalid date range.",
      "error_from_after_to": "From date must be earlier than To date.",
      "error_no_records": "No trip records for selected range.",
      "error_no_data": "No data returned from API.",
      "error_fetch_failed": "Failed to fetch trip summary.",
      "error_no_export": "No data to export. Try fetching a range with trips first.",
      "summary": {
        "vehicle_no": "Vehicle No",
        "start_km": "Start Km",
        "end_km": "End Km",
        "trip_distance": "Trip Distance"
      },
      "status": {
        "moving": "Moving",
        "parked": "Parked",
        "idle": "Idle"
      },
      "records_title": "Trip Records",
      "search_placeholder": "Search trips...",
      "empty_message": "No trip records found.",
      "columns": {
        "s_no": "S.No",
        "start_time": "Start Time",
        "start_address": "Start Address",
        "end_time": "End Time",
        "end_address": "End Address",
        "vehicle_no": "Vehicle No",
        "position": "Position",
        "total_minutes": "Total Minutes",
        "distance": "Distance"
      }
    }
  },
  "vehicle_tracking": {
    "carousel_title": "({{count}}) Vehicles details",
    "search_placeholder": "Search vehicle...",
    "all_vehicles": "All Vehicles",
    "labels": {
      "speed": "Speed",
      "ignition": "Ignition",
      "distance": "Distance",
      "updated": "Updated"
    }
  },
  "vehicle_history": {
    "title": "History for {{vehicleId}}",
    "play": "Play",
    "pause": "Pause",
    "location_fallback": "Location",
    "filters": {
      "vehicle": "Vehicle",
      "from": "From",
      "to": "To"
    },
    "error_select_vehicle": "Select a vehicle to load history.",
    "error_invalid_range": "Invalid date range selected.",
    "error_from_after_to": "From date must be earlier than To date.",
    "error_no_history": "No history available in this range.",
    "error_load_failed": "Unable to load vehicle history."
  },
  "workforce_management": {
    "input_stats_title": "Input Waste Statistics",
    "stats": {
      "ticket": "Ticket",
      "tons": "Tons"
    },
    "reports_title": "Reports",
    "reports": {
      "day": "Day Wise Report",
      "date": "Date Wise Report"
    },
    "reports_cta": "Click Here",
    "multimedia_title": "Multimedia",
    "multimedia_plant": "Plant",
    "multimedia_live": "Live Stream",
    "footer": "Copyright © 2024-2025 ZIGMA",
    "region_en": "UTTAR PRADESH",
    "region_local": "Uttar Pradesh",
    "rights": "All Rights Reserved.",
    "date_report": {
      "title": "Date-wise Waste Report",
      "subtitle": "Consolidated waste metrics by date",
      "filters": {
        "from": "From",
        "to": "To"
      },
      "search_placeholder": "Search Date / Time / Weights",
      "error_from_after_to": "From Date cannot be later than To Date",
      "error_no_data": "No data available",
      "error_load_failed": "Unable to load data",
      "empty_message": "No records found",
      "columns": {
        "s_no": "S.No",
        "date": "Date",
        "start_time": "Start Time",
        "end_time": "End Time",
        "trips": "Trips",
        "dry": "Dry (kg)",
        "wet": "Wet (kg)",
        "mixed": "Mixed (kg)",
        "net": "Net (kg)",
        "avg_trip": "Avg / Trip"
      }
    },
    "day_report": {
      "title": "Day-wise Waste Report",
      "subtitle": "Daily vehicle & waste collection summary",
      "filters": {
        "from": "From",
        "to": "To"
      },
      "search_placeholder": "Search Ticket / Vehicle / Date",
      "error_from_after_to": "From Date cannot be greater than To Date",
      "error_no_data": "No data available",
      "error_load_failed": "API error occurred",
      "empty_message": "No records found",
      "columns": {
        "s_no": "S.No",
        "date": "Date",
        "start_time": "Start Time",
        "ticket_no": "Ticket No",
        "vehicle_no": "Vehicle No",
        "dry": "Dry (kg)",
        "wet": "Wet (kg)",
        "mixed": "Mixed (kg)",
        "net": "Net (kg)",
        "avg_trip": "Avg / Trip"
      }
    }
  },
  "dashboard_home": {
    "title": "Operations Overview",
    "subtitle": "Live snapshot of fleet, crew, and citizen services across the corporation.",
    "metrics": {
      "daily_collections": "Daily Collections",
      "daily_collections_trend": "+6% vs last week",
      "active_vehicles": "Active Vehicles",
      "active_vehicles_trend": "34 routes in transit",
      "on_ground_staff": "On-ground Staff",
      "on_ground_staff_trend": "92% attendance today",
      "critical_alerts": "Critical Alerts",
      "critical_alerts_trend": "4 new in the last hour"
    },
    "recent_activity_title": "Recent Activity",
    "capacity_snapshot_title": "Capacity Snapshot",
    "activity": {
      "route_survey_title": "Route Survey Completed",
      "route_survey_desc": "Zone 4 • Ward 18 • 42 households mapped",
      "route_survey_time": "3 mins ago",
      "route_survey_status": "Completed",
      "missed_pickup_title": "Missed Pickup Alert",
      "missed_pickup_desc": "Zone 2 • Ward 07 • Vehicle TN38 AA 1234",
      "missed_pickup_time": "12 mins ago",
      "missed_pickup_status": "Exception",
      "bulk_waste_title": "Bulk Waste Request",
      "bulk_waste_desc": "Coimbatore North • Industrial estate",
      "bulk_waste_time": "30 mins ago",
      "bulk_waste_status": "In-progress"
    },
    "capacity": {
      "total_vehicles": "Total Vehicles",
      "total_vehicles_hint": "34 routes running",
      "field_staff": "Field Staff",
      "field_staff_hint": "1,311 checked-in",
      "processing_units": "Processing Units",
      "processing_units_hint": "Avg load 78%"
    }
  }
} as const;
