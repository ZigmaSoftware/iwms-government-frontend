export default {
  "weighbridge": {
    "title": "எடையிடல் பதிவு",
    "subtitle": "நேரடி எடை கண்காணிப்பு மற்றும் வேறுபாடு கண்டறிதல்",
    "refresh": "புதுப்பிக்க",
    "stats": {
      "total_entries": "இன்றைய மொத்த பதிவுகள்",
      "within_tolerance": "அனுமதிக்கப்பட்ட வரம்பில்",
      "minor_deviations": "சிறிய விலகல்கள்",
      "critical_mismatch": "முக்கிய வேறுபாடு"
    },
    "table_title": "எடை பதிவுகள்",
    "table_subtitle": "தானியங்கி வேறுபாடு கண்டறிதலுடன் நேரடி இணைப்பு",
    "to": "வரை",
    "headers": {
      "time": "நேரம்",
      "vehicle": "வாகனம்",
      "zone": "மண்டலம்",
      "expected": "எதிர்பார்ப்பு",
      "actual": "உண்மை",
      "difference": "வேறுபாடு",
      "status": "நிலை",
      "action": "செயல்"
    },
    "status": {
      "normal": "சாதாரணம்",
      "warning": "எச்சரிக்கை",
      "critical": "முக்கியம்"
    },
    "action_investigate": "விசாரிக்க",
    "action_view": "பார்க்க",
    "rows_per_page": "பக்கத்திற்கு வரிசைகள்",
    "page_of": "பக்கம் {{page}} / {{totalPages}}",
    "tolerance_title": "அனுமதி அமைப்புகள்",
    "tolerance_subtitle": "தற்போதைய எடை வரம்புகள் மற்றும் எச்சரிக்கை அளவுகள்",
    "tolerance_normal_title": "சாதாரண அனுமதி",
    "tolerance_normal_desc": "எச்சரிக்கைகள் இல்லை",
    "tolerance_warning_title": "எச்சரிக்கை வரம்பு",
    "tolerance_warning_desc": "சரிபார்ப்பு தேவை",
    "tolerance_critical_title": "முக்கிய வரம்பு",
    "tolerance_critical_desc": "உடனடி விசாரணை"
  }
} as const;
