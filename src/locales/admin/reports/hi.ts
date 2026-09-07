export default {
  "reports": {
    "waste_summary": {
      "title": "कचरा संग्रह सारांश",
      "subtitle": "मासिक कचरा संग्रह विश्लेषण",
      "search_placeholder": "कचरा सारांश खोजें...",
      "empty_message": "कोई कचरा डेटा नहीं मिला।",
      "export_sheet": "कचरा सारांश",
      "export_file_prefix": "waste-summary",
      "columns": {
        "s_no": "क्रमांक",
        "date": "तारीख",
        "total_household": "कुल घर",
        "collected": "संग्रहित",
        "not_collected": "नहीं संग्रहित",
        "vehicle_count": "वाहनों की संख्या",
        "trip_count": "यात्रा संख्या",
        "dry_weight": "सूखा वजन/किग्रा",
        "wet_weight": "गीला वजन/किग्रा",
        "mixed_weight": "मिश्रित वजन/किग्रा",
        "weighment": "कुल वजन/किग्रा",
        "avg_per_trip": "औसत / यात्रा"
      }
    },
    "monthly_distance": {
      "title": "मासिक दूरी",
      "search_placeholder": "वाहन खोजें...",
      "error_fallback": "वैकल्पिक वाहन सूची उपयोग में",
      "error_unavailable": "वाहन सूची उपलब्ध नहीं",
      "error_partial": "कुछ वाहन लोड नहीं हो पाए",
      "loading_vehicles": "वाहन लोड हो रहे हैं...",
      "loading_distances": "दूरी डेटा लोड हो रहा है...",
      "loaded_vehicles": "लोड किए गए वाहन: {{count}}",
      "export_sheet": "मासिक दूरी",
      "export_file_prefix": "monthly-distance",
      "columns": {
        "index": "#",
        "vehicle_id": "वाहन ID",
        "total": "कुल"
      }
    },
    "trip_summary": {
      "title": "यात्रा सारांश",
      "export_sheet": "यात्रा सारांश",
      "filters": {
        "vehicle_id": "वाहन ID",
        "from_date": "प्रारंभ तिथि",
        "to_date": "अंतिम तिथि"
      },
      "roster_no_live": "कोई लाइव वाहन नहीं। बैकअप सूची दिख रही है।",
      "roster_unavailable": "लाइव वाहन सूची उपलब्ध नहीं। बैकअप सूची उपयोग हो रही है।",
      "error_select_vehicle": "कृपया वाहन चुनें।",
      "error_invalid_range": "अमान्य तिथि सीमा।",
      "error_from_after_to": "प्रारंभ तिथि अंतिम तिथि से पहले होनी चाहिए।",
      "error_no_records": "चयनित सीमा के लिए कोई यात्रा रिकॉर्ड नहीं।",
      "error_no_data": "API से डेटा नहीं मिला।",
      "error_fetch_failed": "यात्रा सारांश प्राप्त नहीं हो सका।",
      "error_no_export": "निर्यात के लिए डेटा नहीं। पहले यात्रा सीमा चुनें।",
      "summary": {
        "vehicle_no": "वाहन नंबर",
        "start_km": "प्रारंभ किमी",
        "end_km": "अंत किमी",
        "trip_distance": "यात्रा दूरी"
      },
      "status": {
        "moving": "चल रहा",
        "parked": "पार्क्ड",
        "idle": "निष्क्रिय"
      },
      "records_title": "यात्रा रिकॉर्ड",
      "search_placeholder": "यात्रा खोजें...",
      "empty_message": "कोई यात्रा रिकॉर्ड नहीं मिला।",
      "columns": {
        "s_no": "क्रमांक",
        "start_time": "प्रारंभ समय",
        "start_address": "प्रारंभ पता",
        "end_time": "समाप्ति समय",
        "end_address": "समाप्ति पता",
        "vehicle_no": "वाहन नंबर",
        "position": "स्थिति",
        "total_minutes": "कुल मिनट",
        "distance": "दूरी"
      }
    }
  },
  "vehicle_tracking": {
    "carousel_title": "({{count}}) वाहन विवरण",
    "search_placeholder": "वाहन खोजें...",
    "all_vehicles": "सभी वाहन",
    "labels": {
      "speed": "गति",
      "ignition": "इग्निशन",
      "distance": "दूरी",
      "updated": "अपडेट"
    }
  },
  "vehicle_history": {
    "title": "{{vehicleId}} का इतिहास",
    "play": "चलाएँ",
    "pause": "रोकें",
    "location_fallback": "लोकेशन",
    "filters": {
      "vehicle": "वाहन",
      "from": "से",
      "to": "तक"
    },
    "error_select_vehicle": "इतिहास देखने के लिए वाहन चुनें।",
    "error_invalid_range": "अमान्य तिथि सीमा चुनी गई।",
    "error_from_after_to": "प्रारंभ तिथि अंतिम तिथि से पहले होनी चाहिए।",
    "error_no_history": "इस सीमा में कोई इतिहास उपलब्ध नहीं है।",
    "error_load_failed": "वाहन इतिहास लोड नहीं हो सका।"
  },
  "workforce_management": {
    "input_stats_title": "इनपुट कचरा आँकड़े",
    "stats": {
      "ticket": "टिकट",
      "tons": "टन"
    },
    "reports_title": "रिपोर्ट",
    "reports": {
      "day": "दिनवार रिपोर्ट",
      "date": "तिथि वार रिपोर्ट"
    },
    "reports_cta": "यहाँ क्लिक करें",
    "multimedia_title": "मल्टीमीडिया",
    "multimedia_plant": "प्लांट",
    "multimedia_live": "लाइव स्ट्रीम",
    "footer": "कॉपीराइट © 2024-2025 ZIGMA",
    "region_en": "UTTAR PRADESH",
    "region_local": "उत्तर प्रदेश",
    "rights": "सर्वाधिकार सुरक्षित।",
    "date_report": {
      "title": "तिथि वार कचरा रिपोर्ट",
      "subtitle": "तिथि अनुसार समेकित कचरा मीट्रिक",
      "filters": {
        "from": "से",
        "to": "तक"
      },
      "search_placeholder": "तिथि / समय / वजन खोजें",
      "error_from_after_to": "प्रारंभ तिथि अंतिम तिथि से बाद की नहीं हो सकती",
      "error_no_data": "कोई डेटा उपलब्ध नहीं",
      "error_load_failed": "डेटा लोड नहीं हो सका",
      "empty_message": "कोई रिकॉर्ड नहीं मिला",
      "columns": {
        "s_no": "क्रमांक",
        "date": "तारीख",
        "start_time": "प्रारंभ समय",
        "end_time": "समाप्ति समय",
        "trips": "यात्राएँ",
        "dry": "सूखा (किग्रा)",
        "wet": "गीला (किग्रा)",
        "mixed": "मिश्रित (किग्रा)",
        "net": "कुल (किग्रा)",
        "avg_trip": "औसत / यात्रा"
      }
    },
    "day_report": {
      "title": "दिनवार कचरा रिपोर्ट",
      "subtitle": "दैनिक वाहन एवं कचरा संग्रह सारांश",
      "filters": {
        "from": "से",
        "to": "तक"
      },
      "search_placeholder": "टिकट / वाहन / तिथि खोजें",
      "error_from_after_to": "प्रारंभ तिथि अंतिम तिथि से बड़ी नहीं हो सकती",
      "error_no_data": "कोई डेटा उपलब्ध नहीं",
      "error_load_failed": "API त्रुटि हुई",
      "empty_message": "कोई रिकॉर्ड नहीं मिला",
      "columns": {
        "s_no": "क्रमांक",
        "date": "तारीख",
        "start_time": "प्रारंभ समय",
        "ticket_no": "टिकट नंबर",
        "vehicle_no": "वाहन नंबर",
        "dry": "सूखा (किग्रा)",
        "wet": "गीला (किग्रा)",
        "mixed": "मिश्रित (किग्रा)",
        "net": "कुल (किग्रा)",
        "avg_trip": "औसत / यात्रा"
      }
    }
  },
  "dashboard_home": {
    "title": "संचालन अवलोकन",
    "subtitle": "निगम भर में फ्लीट, टीम और नागरिक सेवाओं की लाइव झलक।",
    "metrics": {
      "daily_collections": "दैनिक संग्रह",
      "daily_collections_trend": "+6% पिछले सप्ताह की तुलना में",
      "active_vehicles": "सक्रिय वाहन",
      "active_vehicles_trend": "34 रूट ट्रांजिट में",
      "on_ground_staff": "मैदान कर्मी",
      "on_ground_staff_trend": "आज 92% उपस्थिति",
      "critical_alerts": "गंभीर अलर्ट",
      "critical_alerts_trend": "पिछले घंटे में 4 नए"
    },
    "recent_activity_title": "हालिया गतिविधि",
    "capacity_snapshot_title": "क्षमता स्नैपशॉट",
    "activity": {
      "route_survey_title": "रूट सर्वे पूरा",
      "route_survey_desc": "ज़ोन 4 • वार्ड 18 • 42 घर मैप किए गए",
      "route_survey_time": "3 मिनट पहले",
      "route_survey_status": "पूर्ण",
      "missed_pickup_title": "मिस्ड पिकअप अलर्ट",
      "missed_pickup_desc": "ज़ोन 2 • वार्ड 07 • वाहन TN38 AA 1234",
      "missed_pickup_time": "12 मिनट पहले",
      "missed_pickup_status": "अपवाद",
      "bulk_waste_title": "थोक कचरा अनुरोध",
      "bulk_waste_desc": "कोयंबटूर उत्तर • औद्योगिक क्षेत्र",
      "bulk_waste_time": "30 मिनट पहले",
      "bulk_waste_status": "प्रगति में"
    },
    "capacity": {
      "total_vehicles": "कुल वाहन",
      "total_vehicles_hint": "34 रूट चल रहे हैं",
      "field_staff": "मैदान स्टाफ",
      "field_staff_hint": "1,311 चेक-इन",
      "processing_units": "प्रोसेसिंग यूनिट्स",
      "processing_units_hint": "औसत लोड 78%"
    }
  }
} as const;
