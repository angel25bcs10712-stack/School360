const patterns = {
  status: /शिकायत|रिपोर्ट|आवेदन|report|complaint|status|स्थिति|कहाँ तक|क्या हुआ/,
  issue: /खराब|टूटा|टूटी|टूट|नहीं चल|नहीं है|मरम्मत|गंदा|गंदी|गंदगी|सफाई|साफ़ नहीं|साफ नहीं|लीक|समस्या|दिक्कत|काम नहीं|damage|broken|problem|issue|repair|dirty|not clean|not cleaned|not working|not available|no electricity|leak/,
  infrastructure: /उपलब्ध|सुविधा|पानी|जल|शौचालय|टॉयलेट|बिजली|कक्षा|फर्नीचर|बेंच|facility|infrastructure|water|toilet|electricity|classroom|furniture|available/,
  school: /स्कूल|विद्यालय|कहाँ|खोज|जानकारी|स्कूल का|school|find|search|information/,
  help: /मदद|सहायता|कैसे|क्या कर|help|how do|what can/,
};

export function classifyIntent(input) {
  const text = input.trim().toLocaleLowerCase("hi-IN");
  if (patterns.status.test(text) && /शिकायत|रिपोर्ट|आवेदन|report|complaint/.test(text)) {
    return "CHECK_REPORT_STATUS";
  }
  if (patterns.issue.test(text)) return "REPORT_ISSUE";
  if (patterns.infrastructure.test(text)) return "GET_INFRASTRUCTURE_INFO";
  if (patterns.school.test(text)) return "SEARCH_SCHOOL";
  if (patterns.help.test(text)) return "GENERAL_HELP";
  return "GENERAL_HELP";
}

export function classifyCategory(input) {
  const text = input.toLocaleLowerCase("hi-IN");
  if (/पानी|जल\s*(?:आपूर्ति|संकट|टंकी)|नल|टंकी|\bwater\b|\btap\b/.test(text)) return "WATER";
  if (/सफाई|गंदा|गंदी|कचरा|साफ़ नहीं|साफ नहीं|clean|dirty|garbage/.test(text)) return "CLEANLINESS";
  if (/शौचालय|टॉयलेट|toilet|washroom/.test(text)) return "TOILETS";
  if (/बिजली|विद्युत|पंखा|लाइट|electricity|power|fan|light/.test(text)) return "ELECTRICITY";
  if (/कक्षा|कमरा|छत|दीवार|classroom|room|roof|wall/.test(text)) return "CLASSROOM";
  if (/फर्नीचर|बेंच|डेस्क|कुर्सी|furniture|bench|desk|chair/.test(text)) return "FURNITURE";
  return null;
}
