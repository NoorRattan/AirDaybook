"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const hi: Record<string, string> = {
  "Skip to content": "मुख्य सामग्री पर जाएँ",
  Today: "आज", "My Plan": "मेरी योजना", "CPCB readings": "CPCB के माप",
  "Air quality and your day": "हवा की गुणवत्ता और आपका दिन",
  "Start with a local reading. Then plan school pickups, errands and time outdoors around what you can change.": "अपने इलाके के माप से शुरू करें। फिर बच्चों को स्कूल से लेने, बाहर के काम और बाहर बिताए जाने वाले समय की योजना बनाएँ।",
  "Enter a reading": "माप दर्ज करें", "Change reading": "माप बदलें", "Open My Plan": "मेरी योजना खोलें",
  "Import JSON": "JSON फ़ाइल से माप लें", "Try historical replay": "पुराना उदाहरण देखें",
  "Selected reading": "चुना हुआ माप", "No current reading": "कोई मौजूदा माप नहीं",
  "Opening your workspace": "आपकी योजना खोली जा रही है", "Stale reading": "पुराना माप",
  "Historical replay": "पुराना उदाहरण", "User-supplied reading": "आपका दर्ज किया हुआ माप",
  "Display only": "जानकारी के लिए", "City reading": "शहर का माप", "Station reading": "निगरानी केंद्र का माप",
  "Manual entry": "खुद दर्ज किया", "City model estimate": "शहर का मॉडल अनुमान",
  "User-imported JSON": "आपकी JSON फ़ाइल से", "Averaging window unavailable": "औसत की अवधि उपलब्ध नहीं है",
  Good: "अच्छी", Satisfactory: "संतोषजनक", Moderate: "मध्यम", Poor: "खराब", "Very Poor": "बहुत खराब", Severe: "गंभीर",
  "City or station name": "शहर या निगरानी केंद्र का नाम", "Geographic scope": "माप का क्षेत्र",
  City: "शहर", Station: "निगरानी केंद्र", "Source name": "स्रोत का नाम", "Source link (optional)": "स्रोत का लिंक (वैकल्पिक)",
  "Observation time": "माप का समय", "UTC offset (+05:30 for IST)": "UTC से अंतर (भारत के लिए +05:30)",
  Metric: "माप का प्रकार", Scale: "पैमाना", Basis: "आधार", "Indian AQI": "भारतीय AQI", "US AQI": "अमेरिकी AQI",
  "Overall AQI": "समग्र AQI", "Pollutant sub-index": "प्रदूषक का उप-सूचकांक", Unknown: "अज्ञात",
  Unit: "इकाई", "Reported value": "दर्ज मान", "Averaging minutes (optional)": "औसत की अवधि, मिनट में (वैकल्पिक)",
  Cancel: "रद्द करें", "Save reading": "माप सहेजें", "Use the value and time reported by your source.": "स्रोत में दिया गया मान और समय दर्ज करें।",
  "Find a city PM₂.₅ estimate": "शहर का PM₂.₅ अनुमान देखें", "Load city estimate": "शहर का अनुमान दिखाएँ",
  "CAMS model estimate. Use CPCB for station measurements and Indian AQI.": "यह CAMS मॉडल का अनुमान है। केंद्र के माप और भारतीय AQI के लिए CPCB देखें।",
  "Keep your fixed commitments and make room for changes at home, on the way, and with your group.": "तय कामों का समय रखें। घर, यात्रा और समूह की गतिविधियों में बदलाव की योजना बनाएँ।",
  Schedule: "समय-सारणी", "Daily routine": "दिनचर्या", "Indoor air": "घर की हवा", Preferences: "विकल्प",
  Travel: "यात्रा", "Group note": "समूह संदेश", "Fixed commitment": "तय काम", "No time saved.": "कोई समय सहेजा नहीं गया है।",
  "No reading selected": "कोई माप चुना नहीं गया है", "View reading details": "माप की जानकारी देखें", "Add a reading": "माप जोड़ें",
  "Ask the day-plan assistant": "योजना सहायक से पूछें", "Adjust preferences": "विकल्प बदलें", "Plan your daily routine": "अपनी दिनचर्या बनाएँ",
  "Improve indoor air": "घर की हवा सुधारें", "Compare two routes": "दो रास्तों की तुलना करें", "Write a group note": "समूह के लिए संदेश लिखें",
  Commitment: "तय काम", "Fixed time": "तय समय", "Outdoor waiting estimates": "बाहर इंतज़ार का अनुमान",
  "Current wait (min)": "मौजूदा इंतज़ार (मिनट)", "Revised wait (min)": "बदलाव के बाद इंतज़ार (मिनट)", "Save plan": "योजना सहेजें",
  "Outdoor waiting": "बाहर इंतज़ार", Minutes: "मिनट", Current: "मौजूदा", Revised: "बदलाव के बाद",
  "What you can change": "आप क्या बदल सकते हैं", "What changed?": "क्या बदला?",
  "Air purifier available": "एयर प्यूरीफ़ायर उपलब्ध है", "Metro available": "मेट्रो उपलब्ध है",
  "Activity can move indoors": "गतिविधि अंदर की जा सकती है", "Errands can be combined": "बाहर के काम साथ किए जा सकते हैं",
  "Not set": "तय नहीं", Yes: "हाँ", No: "नहीं", "Suggest preference changes": "बदलाव सुझाएँ",
  "Review the proposed changes": "सुझाए गए बदलाव देखें", Discard: "हटाएँ", "Apply changes": "बदलाव लागू करें",
  "Local planning preferences": "इस डिवाइस पर योजना के विकल्प", "Add an activity": "गतिविधि जोड़ें",
  Activity: "गतिविधि", "Start time": "शुरू होने का समय", Fixed: "तय समय", Outdoors: "बाहर", Indoors: "अंदर",
  Strenuous: "अधिक मेहनत वाली", "Add to routine": "दिनचर्या में जोड़ें", Remove: "हटाएँ",
  "Usual routine and suggested changes": "सामान्य दिनचर्या और सुझाए गए बदलाव", "Outdoor time for these activities": "इन गतिविधियों के लिए बाहर का समय",
  "Current route": "मौजूदा रास्ता", "Alternative route": "दूसरा रास्ता", "Main mode": "यात्रा का मुख्य साधन", "Select mode": "साधन चुनें",
  Vehicle: "वाहन", Traffic: "यातायात", Unspecified: "तय नहीं", "Save and compare": "सहेजें और तुलना करें",
  "Time door to door": "दरवाज़े से दरवाज़े तक का समय", Alternative: "दूसरा रास्ता",
  "Community share": "समूह के लिए संदेश", "Note language": "संदेश की भाषा", "Group activity": "समूह की गतिविधि",
  "Agreed action": "तय कदम", "Share preview": "संदेश का पूर्वावलोकन", "Copy note": "संदेश कॉपी करें",
  "Clear saved data": "सहेजा डेटा मिटाएँ", "Clear saved data?": "सहेजा डेटा मिटाएँ?", "Clear reading and plan": "माप और योजना मिटाएँ",
  "Your reading and plan stay on this device.": "आपका माप और योजना इसी डिवाइस पर रहते हैं।",
  "Available offline": "ऑफ़लाइन उपलब्ध", "Offline mode": "ऑफ़लाइन", "Preparing offline access": "ऑफ़लाइन उपयोग की तैयारी", "Offline access unavailable": "ऑफ़लाइन उपयोग उपलब्ध नहीं है",
  "Open Today": "आज का पृष्ठ खोलें", "Page not found": "पृष्ठ नहीं मिला",
  "View the dated CAQM orders": "तारीख़ वाले CAQM आदेश देखें",
  "Calculate particle clean-air delivery": "कणों के लिए ज़रूरी साफ़ हवा की दर निकालें",
  "Project repeat trips and cost": "महीने की यात्राओं और खर्च का अनुमान",
  "Extra precautions for household members who are more affected by air pollution": "वायु प्रदूषण से अधिक प्रभावित परिवार के सदस्यों के लिए अतिरिक्त सावधानी",
  "Open wood, coal or charcoal heating inside": "घर के अंदर खुली लकड़ी, कोयले या अंगीठी से गर्मी",
  "Outdoor work that cannot be moved": "बाहर का काम जिसे बदला नहीं जा सकता",
  "Planning for a school, workplace or residential group": "स्कूल, कार्यस्थल या आवासीय समूह की योजना",
  "AI suggestions are unavailable. You can still change preferences here.": "AI सुझाव उपलब्ध नहीं हैं। आप यहाँ विकल्प बदल सकते हैं।",
  "Checking AI availability…": "देख रहे हैं कि AI उपलब्ध है या नहीं…",
  "AI suggestions require an internet connection.": "AI सुझावों के लिए इंटरनेट चाहिए।",
  "Checking the update…": "बदलाव की जाँच हो रही है…",
  "We don’t have a purifier or Metro access.": "हमारे पास प्यूरीफ़ायर या मेट्रो की सुविधा नहीं है।",
  "We don’t have a purifier. What can we do about indoor air?": "हमारे पास प्यूरीफ़ायर नहीं है। घर की हवा के लिए क्या कर सकते हैं?",
  "Help me compare a carpool with Metro.": "साझा कार और मेट्रो की तुलना करने में मदद करें।",
  "Help me draft a Hindi group note.": "समूह के लिए हिन्दी में संदेश लिखने में मदद करें।",
  "Help me move a flexible outdoor activity indoors.": "बाहर की एक गतिविधि को अंदर करने की योजना बनाने में मदद करें।",
};

type Language = "en" | "hi";
const LocaleContext = createContext<{
  language: Language;
  changeLanguage: (language: Language) => void;
  t: (text: string) => string;
}>({ language: "en", changeLanguage: () => {}, t: (text) => text });

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>("en");
  useEffect(() => {
    try {
      if (localStorage.getItem("airdaybook-language") === "hi") setLanguage("hi");
    } catch { /* The switch still works in memory. */ }
  }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  function changeLanguage(next: Language) {
    setLanguage(next);
    try { localStorage.setItem("airdaybook-language", next); } catch { /* Keep the in-session selection. */ }
  }
  return <LocaleContext.Provider value={{ language, changeLanguage, t: (text) => language === "hi" && Object.hasOwn(hi, text) ? hi[text] : text }}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}

export function SkipLink() {
  const { t } = useLocale();
  return <a href="#main-content" className="skip-link">{t("Skip to content")}</a>;
}
