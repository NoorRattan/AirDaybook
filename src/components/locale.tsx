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
  "Day-plan assistant": "दिन की योजना का सहायक",
  "Include routine activities in the suggestion": "सुझाव में दिनचर्या की गतिविधियाँ शामिल करें",
  "Use a sample routine": "उदाहरण वाली दिनचर्या भरें",
  "Draft activities on this device": "इसी डिवाइस पर गतिविधियों का मसौदा बनाएँ",
  "Suggest a routine draft": "दिनचर्या का मसौदा सुझाएँ",
  "Evening walk at 18:00 for 30 minutes outdoors, flexible; Dinner at 20:00 for 45 minutes indoors, fixed": "शाम की सैर १८:०० बजे ३० मिनट बाहर, लचीला; रात का खाना २०:०० बजे ४५ मिनट अंदर, तय",
  characters: "अक्षर", min: "मिनट", Flexible: "समय बदल सकता है", Close: "बंद करें",
  "AI sends only your submitted text and the four preferences to Groq. Leave out names, addresses and medical details.": "AI केवल आपका भेजा पाठ और चार विकल्प Groq को भेजता है। नाम, पते और स्वास्थ्य की जानकारी शामिल न करें।",
  "Drafting on this device keeps your text in this browser.": "इस डिवाइस पर मसौदा बनाने से आपका पाठ इसी ब्राउज़र में रहता है।",
  "Remove phone, email or ID details before sending.": "भेजने से पहले फ़ोन नंबर, ईमेल या पहचान की जानकारी हटा दें।",
  "Remove invisible control characters before sending.": "भेजने से पहले अदृश्य नियंत्रण अक्षर हटा दें।",
  "Retry AI availability": "AI की उपलब्धता फिर जाँचें",
  "Suggestion ready to review.": "सुझाव की समीक्षा करें।",
  "Suggestion discarded.": "सुझाव हटा दिया गया।",
  "Preferences updated.": "विकल्प सहेज दिए गए।",
  "Activities added to your routine.": "गतिविधियाँ आपकी दिनचर्या में जोड़ दी गईं।",
  "Your plan changed. Request a new suggestion to review.": "आपकी योजना बदल गई है। समीक्षा के लिए नया सुझाव लें।",
  "No activities found. Include a start time, duration and indoor or outdoor location.": "कोई गतिविधि नहीं मिली। शुरू होने का समय, अवधि और अंदर या बाहर की जगह लिखें।",
  "No activities or preference changes found. Try the sample format.": "कोई गतिविधि या विकल्प में बदलाव नहीं मिला। उदाहरण का प्रारूप आज़माएँ।",
  "Some activities could not fit around saved times, the end of the day or the routine limit.": "पहले से सहेजे समय, दिन के अंत या गतिविधियों की सीमा के कारण कुछ गतिविधियाँ शामिल नहीं हो सकीं।",
  "Which preference should change? State what is available or possible.": "कौन-सा विकल्प बदलना है? बताएँ कि क्या उपलब्ध है या संभव है।",
  "No preference changes found.": "विकल्पों में कोई बदलाव नहीं मिला।",
  "Check that your update has 1–500 characters.": "देखें कि आपके पाठ में 1 से 500 अक्षर हैं।",
  "Shorten the update and try again.": "पाठ छोटा करके फिर कोशिश करें।",
  "The AI request limit has been reached. You can still change preferences here.": "AI अनुरोधों की सीमा पूरी हो गई है। आप यहाँ विकल्प बदल सकते हैं।",
  "Try again in about {minutes} min.": "लगभग {minutes} मिनट में फिर कोशिश करें।",
  "The suggestion timed out. Try again or use the preference controls.": "सुझाव मिलने में ज़्यादा समय लगा। फिर कोशिश करें या यहाँ विकल्प बदलें।",
  "Compare activity options and keep your fixed times.": "गतिविधियों के विकल्प देखें और तय समय बनाए रखें।",
  "Compare smoke sources, ventilation and particle filtration.": "धुएँ के स्रोत, हवा आने-जाने और कणों को छानने के विकल्प देखें।",
  "Use travel time, outdoor waiting and costs you enter.": "दर्ज किए गए यात्रा समय, बाहर के इंतज़ार और खर्च से तुलना करें।",
  "Start from the selected reading and review an English or Hindi draft.": "चुने हुए माप से शुरू करें और अंग्रेज़ी या हिन्दी में मसौदा देखें।",
  "Compare usual activities with suggested changes while keeping fixed times.": "तय समय बनाए रखते हुए अपनी गतिविधियों और सुझाए गए बदलावों की तुलना करें।",
  "Compare practical source-control and filter options.": "धुएँ के स्रोत कम करने और फ़िल्टर के व्यावहारिक विकल्प देखें।",
  "See time outdoors, total travel and the Metro CO₂ estimate.": "बाहर का समय, पूरी यात्रा का समय और मेट्रो का CO₂ अनुमान देखें।",
  "Share a dated reading in English or Hindi.": "तारीख़ के साथ माप अंग्रेज़ी या हिन्दी में साझा करें।",
  "Plan updated.": "योजना सहेज दी गई।", "Saved data cleared.": "सहेजा हुआ डेटा मिटा दिया गया।",
  "Draft storage is unavailable. Your changes last until you close or reload this page.": "सहेजने की सुविधा उपलब्ध नहीं है। बदलाव पृष्ठ बंद करने या फिर से खोलने तक रहेंगे।",
  "This removes the selected reading, plan, daily routine, preferences and route comparison from this device.": "इस डिवाइस से चुना हुआ माप, योजना, दिनचर्या, विकल्प और रास्तों की तुलना मिट जाएगी।",
  "These selections stay on this device.": "ये विकल्प इसी डिवाइस पर रहते हैं।",
  "The guidance below uses the historical replay.": "नीचे की सलाह पुराने उदाहरण पर आधारित है।",
  "NCDC guidance": "NCDC की सलाह", "e.g. Evening walk": "जैसे शाम की सैर", "Move indoors": "अंदर करें",
  "Activity added.": "गतिविधि जोड़ दी गई।", "Activity removed.": "गतिविधि हटा दी गई।",
  "Remove {activity} at {time}": "{time} की गतिविधि {activity} हटाएँ",
  "Enter an activity name, a valid time and a duration of 1–720 minutes.": "गतिविधि का नाम, सही समय और 1 से 720 मिनट की अवधि दर्ज करें।",
  "Strenuous outdoor time moved indoors": "बाहर की मेहनत वाली गतिविधियाँ अंदर करने का समय",
  "Reduce smoke at the source": "धुएँ के स्रोत कम करें",
  "Skip indoor incense, coils and smoking. Use an exhaust fan that vents outdoors when cooking, and avoid charring food.": "घर के अंदर अगरबत्ती, मच्छर भगाने वाली कॉइल और धूम्रपान से बचें। खाना पकाते समय बाहर हवा निकालने वाला एग्ज़ॉस्ट चलाएँ और खाना जलने से बचाएँ।",
  "Check conditions before airing": "खिड़की खोलने से पहले बाहर की हवा देखें",
  "Look up the current reading before opening windows for routine airing. Keep required cooking and appliance ventilation available.": "कमरे की हवा बदलने के लिए खिड़की खोलने से पहले मौजूदा माप देखें। खाना पकाने और उपकरणों के लिए ज़रूरी वेंटिलेशन बनाए रखें।",
  "Use one room for particle filtration": "एक कमरे की हवा से कण छानें",
  "Run a purifier sized for the room you use most. Follow the device’s filter maintenance instructions and avoid units that intentionally produce ozone.": "जिस कमरे में सबसे ज़्यादा समय बिताते हैं, उसके आकार के हिसाब से प्यूरीफ़ायर चलाएँ। फ़िल्टर की देखभाल के निर्देश मानें और ओज़ोन बनाने वाले उपकरणों से बचें।",
  "Clean settled dust with a damp cloth or mop": "जमी धूल गीले कपड़े या पोछे से साफ़ करें",
  "Damp cleaning keeps settled particles from going back into the air.": "गीली सफ़ाई से जमे कण फिर हवा में उड़ने से बचते हैं।",
  "EPA cleaner-air room guidance": "कमरे की हवा साफ़ रखने के EPA के निर्देश",
  "Compare a low-cost filter": "कम खर्च वाले फ़िल्टर के विकल्प देखें",
  "EPA publishes MERV 13 box-fan designs and electrical safety considerations. Use equipment rated for your local power supply.": "EPA के पास MERV 13 फ़िल्टर और बॉक्स फ़ैन के डिज़ाइन और बिजली की सुरक्षा के निर्देश हैं। अपने इलाके की बिजली आपूर्ति के लिए उपयुक्त उपकरण इस्तेमाल करें।",
  "EPA instructions and safety checks": "EPA के निर्देश और सुरक्षा जाँच",
  "Room area (m²)": "कमरे का क्षेत्रफल (m²)", "Ceiling height (m)": "छत की ऊँचाई (m)",
  "Target air changes per hour": "एक घंटे में हवा बदलने की लक्षित संख्या",
  "estimated particle CADR at your selected air-change target.": "आपके चुने हुए लक्ष्य के लिए कणों को छानकर साफ़ हवा देने की अनुमानित दर (CADR)।",
  "EPA room sizing and filter guidance": "कमरे और फ़िल्टर के आकार पर EPA की सलाह",
  "(opens in a new tab)": "(नए टैब में खुलेगा)",
  "Previously {value}": "पहले {value}",
  "Example from the archive. Check CPCB for today’s reading.": "यह पुराने रिकॉर्ड का उदाहरण है। आज का माप CPCB पर देखें।",
  "This reading is over six hours old. Check a newer reading before making decisions.": "यह माप छह घंटे से पुराना है। फ़ैसला करने से पहले कोई नया माप देखें।",
  "Look up your city or station on CPCB and enter the reading here. You can also start planning before you have one.": "CPCB पर अपने शहर या निगरानी केंद्र का माप देखें और यहाँ दर्ज करें। आप माप दर्ज करने से पहले भी योजना बना सकते हैं।",
  "Checking for a reading saved on this device.": "इस डिवाइस पर सहेजा हुआ माप ढूँढ रहे हैं।",
  "Current CAQM notices": "CAQM की मौजूदा सूचनाएँ",
  "TERI project summary": "TERI परियोजना का सारांश",
  "The selected reading is unchanged.": "चुना हुआ माप वही है।",
  "The city PM₂.₅ estimate shows pollution context. Activity suggestions use the bands from a recent Indian overall AQI reading.": "शहर का PM₂.₅ अनुमान प्रदूषण की जानकारी देता है। गतिविधियों के सुझाव हाल के समग्र भारतीय AQI की श्रेणियों पर आधारित हैं।",
  Walking: "पैदल चलना", "All waiting": "कुल इंतज़ार", "Outside waiting": "बाहर का इंतज़ार", Riding: "वाहन में समय",
  Open: "खुला", Enclosed: "बंद", Mixed: "मिश्रित", Light: "कम", Heavy: "भारी",
  "Motorized road": "सड़क पर मोटर वाहन", "Delhi Metro": "दिल्ली मेट्रो", "Walk or cycle": "पैदल या साइकिल", Other: "अन्य",
  "Two-wheeler": "दोपहिया", Carpool: "साझा कार", "City bus": "शहर की बस", "Electric bus": "इलेक्ट्रिक बस",
  "Auto or rickshaw": "ऑटो या रिक्शा", "Electric car": "इलेक्ट्रिक कार", "Other metro or suburban rail": "अन्य मेट्रो या उपनगरीय ट्रेन", "No trip": "कोई यात्रा नहीं",
  "Whole trip": "पूरी यात्रा", "Walk + outdoor wait": "पैदल चलना और बाहर का इंतज़ार",
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
