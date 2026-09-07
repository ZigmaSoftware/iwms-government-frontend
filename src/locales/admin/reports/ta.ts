export default {
  "reports": {
    "waste_summary": {
      "title": "கழிவு சேகரிப்பு சுருக்கம்",
      "subtitle": "மாத வாரியான கழிவு சேகரிப்பு பகுப்பாய்வு",
      "search_placeholder": "கழிவு சுருக்கத்தை தேடுக...",
      "empty_message": "கழிவு தரவு கிடைக்கவில்லை.",
      "export_sheet": "கழிவு சுருக்கம்",
      "export_file_prefix": "waste-summary",
      "columns": {
        "s_no": "எண்",
        "date": "தேதி",
        "total_household": "மொத்த வீடுகள்",
        "collected": "சேகரிக்கப்பட்டது",
        "not_collected": "சேகரிக்கப்படவில்லை",
        "vehicle_count": "வாகன எண்ணிக்கை",
        "trip_count": "பயண எண்ணிக்கை",
        "dry_weight": "உலர் எடை/கி.கி",
        "wet_weight": "ஈர எடை/கி.கி",
        "mixed_weight": "கலந்த எடை/கி.கி",
        "weighment": "மொத்த எடை/கி.கி",
        "avg_per_trip": "சராசரி / பயணம்"
      }
    },
    "monthly_distance": {
      "title": "மாதாந்திர தூரம்",
      "search_placeholder": "வாகனத்தை தேடுக...",
      "error_fallback": "மாற்று வாகன பட்டியலை பயன்படுத்துகிறது",
      "error_unavailable": "வாகன பட்டியல் கிடைக்கவில்லை",
      "error_partial": "சில வாகனங்களை ஏற்ற முடியவில்லை",
      "loading_vehicles": "வாகனங்கள் ஏற்றப்படுகிறது...",
      "loading_distances": "தூர தரவு ஏற்றப்படுகிறது...",
      "loaded_vehicles": "ஏற்றப்பட்ட வாகனங்கள்: {{count}}",
      "export_sheet": "மாதாந்திர தூரம்",
      "export_file_prefix": "monthly-distance",
      "columns": {
        "index": "#",
        "vehicle_id": "வாகன ID",
        "total": "மொத்தம்"
      }
    },
    "trip_summary": {
      "title": "பயண சுருக்கம்",
      "export_sheet": "பயண சுருக்கம்",
      "filters": {
        "vehicle_id": "வாகன ID",
        "from_date": "தொடக்க தேதி",
        "to_date": "முடிவு தேதி"
      },
      "roster_no_live": "நேரடி வாகனங்கள் இல்லை. மாற்று பட்டியல் காட்டப்படுகிறது.",
      "roster_unavailable": "நேரடி வாகன பட்டியல் கிடைக்கவில்லை. மாற்று பட்டியல் பயன்படுத்தப்படுகிறது.",
      "error_select_vehicle": "ஒரு வாகனத்தை தேர்ந்தெடுக்கவும்.",
      "error_invalid_range": "தவறான தேதி வரம்பு.",
      "error_from_after_to": "தொடக்க தேதி முடிவு தேதிக்கு முன்னதாக இருக்க வேண்டும்.",
      "error_no_records": "தேர்ந்தெடுத்த வரம்பில் பயண பதிவுகள் இல்லை.",
      "error_no_data": "API இலிருந்து தரவு கிடைக்கவில்லை.",
      "error_fetch_failed": "பயண சுருக்கத்தை பெற முடியவில்லை.",
      "error_no_export": "ஏற்றுமதி செய்ய தரவு இல்லை. பயண வரம்பை பெற முயற்சிக்கவும்.",
      "summary": {
        "vehicle_no": "வாகன எண்",
        "start_km": "தொடக்க கிமீ",
        "end_km": "முடிவு கிமீ",
        "trip_distance": "பயண தூரம்"
      },
      "status": {
        "moving": "இயக்கம்",
        "parked": "நிறுத்தப்பட்டது",
        "idle": "இடைநிலை"
      },
      "records_title": "பயண பதிவுகள்",
      "search_placeholder": "பயணங்களை தேடுக...",
      "empty_message": "பயண பதிவுகள் இல்லை.",
      "columns": {
        "s_no": "எண்",
        "start_time": "தொடக்க நேரம்",
        "start_address": "தொடக்க முகவரி",
        "end_time": "முடிவு நேரம்",
        "end_address": "முடிவு முகவரி",
        "vehicle_no": "வாகன எண்",
        "position": "நிலை",
        "total_minutes": "மொத்த நிமிடங்கள்",
        "distance": "தூரம்"
      }
    }
  },
  "vehicle_tracking": {
    "carousel_title": "({{count}}) வாகன விவரங்கள்",
    "search_placeholder": "வாகனத்தை தேடுக...",
    "all_vehicles": "அனைத்து வாகனங்கள்",
    "labels": {
      "speed": "வேகம்",
      "ignition": "இக்னிஷன்",
      "distance": "தூரம்",
      "updated": "புதுப்பிக்கப்பட்டது"
    }
  },
  "vehicle_history": {
    "title": "{{vehicleId}} வரலாறு",
    "play": "இயக்கு",
    "pause": "இடைநிறுத்து",
    "location_fallback": "இடம்",
    "filters": {
      "vehicle": "வாகனம்",
      "from": "தொடக்கம்",
      "to": "முடிவு"
    },
    "error_select_vehicle": "வரலாறு ஏற்ற ஒரு வாகனத்தை தேர்ந்தெடுக்கவும்.",
    "error_invalid_range": "தவறான தேதி வரம்பு தேர்ந்தெடுக்கப்பட்டது.",
    "error_from_after_to": "தொடக்க தேதி முடிவு தேதிக்கு முன்னதாக இருக்க வேண்டும்.",
    "error_no_history": "இந்த வரம்பில் வரலாறு இல்லை.",
    "error_load_failed": "வாகன வரலாறை ஏற்ற முடியவில்லை."
  },
  "workforce_management": {
    "input_stats_title": "உள்ளீட்டு கழிவு புள்ளிவிவரங்கள்",
    "stats": {
      "ticket": "டிக்கெட்",
      "tons": "டன்"
    },
    "reports_title": "அறிக்கைகள்",
    "reports": {
      "day": "நாள் வார அறிக்கை",
      "date": "தேதி வார அறிக்கை"
    },
    "reports_cta": "இங்கே கிளிக் செய்க",
    "multimedia_title": "மல்டிமீடியா",
    "multimedia_plant": "தொழிற்சாலை",
    "multimedia_live": "நேரடி ஒளிபரப்பு",
    "footer": "பதிப்புரிமை © 2024-2025 ZIGMA",
    "region_en": "UTTAR PRADESH",
    "region_local": "உத்தரப் பிரதேசம்",
    "rights": "அனைத்து உரிமைகளும் பாதுகாக்கப்பட்டவை.",
    "date_report": {
      "title": "தேதி வார கழிவு அறிக்கை",
      "subtitle": "தேதி வாரியாக ஒருங்கிணைந்த கழிவு அளவுகள்",
      "filters": {
        "from": "தொடக்கம்",
        "to": "முடிவு"
      },
      "search_placeholder": "தேதி / நேரம் / எடைகளை தேடுக",
      "error_from_after_to": "தொடக்க தேதி முடிவு தேதிக்கு பின்னதாக இருக்க முடியாது",
      "error_no_data": "தரவு இல்லை",
      "error_load_failed": "தரவை ஏற்ற முடியவில்லை",
      "empty_message": "பதிவுகள் இல்லை",
      "columns": {
        "s_no": "எண்",
        "date": "தேதி",
        "start_time": "தொடக்க நேரம்",
        "end_time": "முடிவு நேரம்",
        "trips": "பயணங்கள்",
        "dry": "உலர் (கி.கி)",
        "wet": "ஈர (கி.கி)",
        "mixed": "கலந்த (கி.கி)",
        "net": "மொத்தம் (கி.கி)",
        "avg_trip": "சராசரி / பயணம்"
      }
    },
    "day_report": {
      "title": "நாள் வார கழிவு அறிக்கை",
      "subtitle": "தினசரி வாகன & கழிவு சேகரிப்பு சுருக்கம்",
      "filters": {
        "from": "தொடக்கம்",
        "to": "முடிவு"
      },
      "search_placeholder": "டிக்கெட் / வாகனம் / தேதி தேடுக",
      "error_from_after_to": "தொடக்க தேதி முடிவு தேதியை விட பெரியதாக இருக்க முடியாது",
      "error_no_data": "தரவு இல்லை",
      "error_load_failed": "API பிழை ஏற்பட்டது",
      "empty_message": "பதிவுகள் இல்லை",
      "columns": {
        "s_no": "எண்",
        "date": "தேதி",
        "start_time": "தொடக்க நேரம்",
        "ticket_no": "டிக்கெட் எண்",
        "vehicle_no": "வாகன எண்",
        "dry": "உலர் (கி.கி)",
        "wet": "ஈர (கி.கி)",
        "mixed": "கலந்த (கி.கி)",
        "net": "மொத்தம் (கி.கி)",
        "avg_trip": "சராசரி / பயணம்"
      }
    }
  },
  "dashboard_home": {
    "title": "செயற்பாட்டு மேலோட்டம்",
    "subtitle": "கழிவு வாகனங்கள், குழுக்கள் மற்றும் குடிமக்கள் சேவைகளின் நேரடி நிலை.",
    "metrics": {
      "daily_collections": "தினசரி சேகரிப்பு",
      "daily_collections_trend": "+6% கடந்த வாரத்தை விட",
      "active_vehicles": "செயலில் உள்ள வாகனங்கள்",
      "active_vehicles_trend": "34 பாதைகள் பயணத்தில்",
      "on_ground_staff": "கள பணியாளர்கள்",
      "on_ground_staff_trend": "இன்று 92% வருகை",
      "critical_alerts": "முக்கிய எச்சரிக்கைகள்",
      "critical_alerts_trend": "கடைசி மணிநேரத்தில் 4 புதியவை"
    },
    "recent_activity_title": "சமீபத்திய செயல்பாடு",
    "capacity_snapshot_title": "திறன் நிலை",
    "activity": {
      "route_survey_title": "பாதை ஆய்வு முடிந்தது",
      "route_survey_desc": "மண்டலம் 4 • வார்டு 18 • 42 வீடுகள் மேப்பிங் செய்யப்பட்டது",
      "route_survey_time": "3 நிமிடங்கள் முன்பு",
      "route_survey_status": "முடிந்தது",
      "missed_pickup_title": "தவறிய சேகரிப்பு எச்சரிக்கை",
      "missed_pickup_desc": "மண்டலம் 2 • வார்டு 07 • வாகனம் TN38 AA 1234",
      "missed_pickup_time": "12 நிமிடங்கள் முன்பு",
      "missed_pickup_status": "விலக்கு",
      "bulk_waste_title": "அதிக அளவு கழிவு கோரிக்கை",
      "bulk_waste_desc": "கோயம்புத்தூர் வடக்கு • தொழிற்பேட்டை",
      "bulk_waste_time": "30 நிமிடங்கள் முன்பு",
      "bulk_waste_status": "நடந்து கொண்டு உள்ளது"
    },
    "capacity": {
      "total_vehicles": "மொத்த வாகனங்கள்",
      "total_vehicles_hint": "34 பாதைகள் இயக்கத்தில்",
      "field_staff": "களப் பணியாளர்கள்",
      "field_staff_hint": "1,311 பதிவு செய்துள்ளனர்",
      "processing_units": "செயலாக்க அலகுகள்",
      "processing_units_hint": "சராசரி சுமை 78%"
    }
  }
} as const;
