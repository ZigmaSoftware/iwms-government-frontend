export default {
  "weighbridge": {
    "title": "वेइब्रिज लॉग",
    "subtitle": "रियल-टाइम वजन ट्रैकिंग और विसंगति निगरानी",
    "refresh": "रीफ़्रेश",
    "stats": {
      "total_entries": "आज की कुल प्रविष्टियाँ",
      "within_tolerance": "सहनशीलता के भीतर",
      "minor_deviations": "छोटे विचलन",
      "critical_mismatch": "गंभीर असंगति"
    },
    "table_title": "वजन प्रविष्टि लॉग",
    "table_subtitle": "स्वचालित विसंगति पहचान के साथ रियल-टाइम इंटीग्रेशन",
    "to": "से",
    "headers": {
      "time": "समय",
      "vehicle": "वाहन",
      "zone": "ज़ोन",
      "expected": "अपेक्षित",
      "actual": "वास्तविक",
      "difference": "अंतर",
      "status": "स्थिति",
      "action": "क्रिया"
    },
    "status": {
      "normal": "सामान्य",
      "warning": "चेतावनी",
      "critical": "गंभीर"
    },
    "action_investigate": "जांच करें",
    "action_view": "देखें",
    "rows_per_page": "प्रति पृष्ठ पंक्तियाँ",
    "page_of": "पृष्ठ {{page}} / {{totalPages}}",
    "tolerance_title": "सहनशीलता सेटिंग्स",
    "tolerance_subtitle": "वर्तमान वेइब्रिज सहनशीलता सीमा और अलर्ट थ्रेशहोल्ड",
    "tolerance_normal_title": "सामान्य सहनशीलता",
    "tolerance_normal_desc": "कोई अलर्ट नहीं",
    "tolerance_warning_title": "चेतावनी सीमा",
    "tolerance_warning_desc": "सत्यापन आवश्यक",
    "tolerance_critical_title": "गंभीर सीमा",
    "tolerance_critical_desc": "तत्काल जांच"
  }
} as const;
