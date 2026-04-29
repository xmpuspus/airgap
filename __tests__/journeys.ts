/**
 * 100 User Journeys for ACMEBot
 * Tests the search + routing pipeline end-to-end.
 *
 * Note: the run-journeys.mjs runner does NOT exercise the tool router or
 * the safety layer — it is a pure JS re-implementation of the search +
 * online-routing logic for fast smoke tests. Tool router behaviour is
 * covered by __tests__/tool-router.test.ts which calls the real
 * src/services/tools.ts and src/services/safetyLayer.ts modules through
 * jest. The 'tool' and 'refusal' route types below exist so a future
 * orchestrator-driven runner can be added without renaming existing
 * cases.
 */

export interface Journey {
  id: number;
  category: string;
  input: string;
  expectRoute:
    | 'greeting'
    | 'online_queue'
    | 'online_mock'
    | 'search_llm'
    | 'fallback'
    | 'tool'
    | 'refusal';
  expectContains?: string[];   // response or search results should contain these
  expectNotContains?: string[]; // should NOT contain these
  description: string;
}

export const journeys: Journey[] = [
  // === GREETINGS (1-8) ===
  {id: 1, category: 'greeting', input: 'Hi', expectRoute: 'greeting', expectContains: ['ACME'], description: 'Simple hi'},
  {id: 2, category: 'greeting', input: 'Hello', expectRoute: 'greeting', description: 'Hello'},
  {id: 3, category: 'greeting', input: 'Hey', expectRoute: 'greeting', description: 'Hey'},
  {id: 4, category: 'greeting', input: 'Good morning', expectRoute: 'greeting', description: 'Good morning'},
  {id: 5, category: 'greeting', input: 'Good afternoon', expectRoute: 'greeting', description: 'Good afternoon'},
  {id: 6, category: 'greeting', input: 'Yo', expectRoute: 'greeting', description: 'Yo'},
  {id: 7, category: 'greeting', input: 'Kamusta', expectRoute: 'greeting', description: 'Filipino greeting'},
  {id: 8, category: 'greeting', input: 'Hi!', expectRoute: 'greeting', description: 'Hi with punctuation'},

  // === PLAN INQUIRIES (9-22) ===
  {id: 9, category: 'plans', input: 'What prepaid plans do you have?', expectRoute: 'search_llm', expectContains: ['Super Surf'], description: 'General prepaid inquiry'},
  {id: 10, category: 'plans', input: 'Show me postpaid plans', expectRoute: 'search_llm', expectContains: ['postpaid', 'Plan'], description: 'Postpaid plans'},
  {id: 11, category: 'plans', input: 'Cheapest data plan', expectRoute: 'search_llm', expectContains: ['PHP'], description: 'Cheapest plan'},
  {id: 12, category: 'plans', input: 'Tell me about Plan 999', expectRoute: 'search_llm', expectContains: ['999'], description: 'Specific plan inquiry'},
  {id: 13, category: 'plans', input: 'Fiber internet plans', expectRoute: 'search_llm', expectContains: ['Fiber', 'Mbps'], description: 'Fiber plans'},
  {id: 14, category: 'plans', input: 'What is included in MegaSurf 299?', expectRoute: 'search_llm', expectContains: ['MegaSurf'], description: 'Specific promo details'},
  {id: 15, category: 'plans', input: 'Do you have unlimited data plans?', expectRoute: 'search_llm', expectContains: ['data'], description: 'Unlimited data inquiry'},
  {id: 16, category: 'plans', input: 'Best plan for streaming', expectRoute: 'search_llm', description: 'Use-case based inquiry'},
  {id: 17, category: 'plans', input: 'Compare Plan 599 and Plan 999', expectRoute: 'search_llm', expectContains: ['Plan'], description: 'Plan comparison'},
  {id: 18, category: 'plans', input: 'Plans with device bundles', expectRoute: 'search_llm', description: 'Device bundle inquiry'},
  {id: 19, category: 'plans', input: 'How much is GigaSurf 299?', expectRoute: 'search_llm', expectContains: ['299'], description: 'Price inquiry'},
  {id: 20, category: 'plans', input: 'What is the fastest fiber plan?', expectRoute: 'search_llm', expectContains: ['Fiber'], description: 'Fastest fiber'},
  {id: 21, category: 'plans', input: 'Monthly postpaid with unlimited calls', expectRoute: 'search_llm', expectContains: ['unlimited'], description: 'Feature-based search'},
  {id: 22, category: 'plans', input: 'ACME Plan 1999', expectRoute: 'search_llm', expectContains: ['1999'], description: 'Premium plan'},

  // === PROMO INQUIRIES (23-30) ===
  {id: 23, category: 'promos', input: 'What promos are available right now?', expectRoute: 'search_llm', description: 'General promos'},
  {id: 24, category: 'promos', input: 'Any data promos under 100 pesos?', expectRoute: 'search_llm', expectContains: ['PHP'], description: 'Budget promo'},
  {id: 25, category: 'promos', input: 'How do I register for Super Surf 99?', expectRoute: 'search_llm', expectContains: ['Super Surf'], description: 'Promo registration'},
  {id: 26, category: 'promos', input: 'Text promos', expectRoute: 'search_llm', description: 'Text/SMS promos'},
  {id: 27, category: 'promos', input: 'Call and text bundle', expectRoute: 'search_llm', description: 'Bundle promo'},
  {id: 28, category: 'promos', input: 'Student discount promo', expectRoute: 'search_llm', description: 'Student promo'},
  {id: 29, category: 'promos', input: 'Combo Sakto 50', expectRoute: 'search_llm', expectContains: ['Combo'], description: 'Specific combo promo'},
  {id: 30, category: 'promos', input: 'AllNet 30 promo details', expectRoute: 'search_llm', expectContains: ['AllNet'], description: 'AllNet promo'},

  // === TROUBLESHOOTING (31-50) ===
  {id: 31, category: 'troubleshoot', input: 'I have no signal on my phone', expectRoute: 'search_llm', expectContains: ['signal', 'Airplane'], description: 'No signal'},
  {id: 32, category: 'troubleshoot', input: 'My data is really slow', expectRoute: 'search_llm', expectContains: ['slow', 'data'], description: 'Slow data'},
  {id: 33, category: 'troubleshoot', input: 'Cannot connect to WiFi', expectRoute: 'search_llm', expectContains: ['WiFi', 'router'], description: 'WiFi issues'},
  {id: 34, category: 'troubleshoot', input: 'How to configure APN settings', expectRoute: 'search_llm', expectContains: ['APN'], description: 'APN config'},
  {id: 35, category: 'troubleshoot', input: 'SIM registration not working', expectRoute: 'search_llm', expectContains: ['registration', 'SIM'], description: 'SIM registration'},
  {id: 36, category: 'troubleshoot', input: 'My phone says emergency calls only', expectRoute: 'search_llm', expectContains: ['signal'], description: 'Emergency calls only'},
  {id: 37, category: 'troubleshoot', input: 'Internet keeps disconnecting', expectRoute: 'search_llm', description: 'Intermittent connectivity'},
  {id: 38, category: 'troubleshoot', input: 'No 4G only showing 3G', expectRoute: 'search_llm', description: 'Network mode issue'},
  {id: 39, category: 'troubleshoot', input: 'My fiber internet is down', expectRoute: 'search_llm', expectContains: ['router'], description: 'Fiber down'},
  {id: 40, category: 'troubleshoot', input: 'How to restart my router', expectRoute: 'search_llm', description: 'Router restart'},
  {id: 41, category: 'troubleshoot', input: 'APN settings for Android', expectRoute: 'search_llm', expectContains: ['APN', 'Android'], description: 'Android APN'},
  {id: 42, category: 'troubleshoot', input: 'APN settings for iPhone', expectRoute: 'search_llm', expectContains: ['APN', 'iPhone'], description: 'iPhone APN'},
  {id: 43, category: 'troubleshoot', input: 'Dial *888# not working', expectRoute: 'search_llm', expectContains: ['888'], description: 'Dial code issue'},
  {id: 44, category: 'troubleshoot', input: 'How to check if my SIM is registered', expectRoute: 'search_llm', expectContains: ['SIM', 'registration'], description: 'SIM reg check'},
  {id: 45, category: 'troubleshoot', input: 'Phone stuck on searching for network', expectRoute: 'search_llm', description: 'Searching network'},
  {id: 46, category: 'troubleshoot', input: 'WiFi password for ACME Telecom router', expectRoute: 'search_llm', expectContains: ['WiFi', 'password'], description: 'WiFi password'},
  {id: 47, category: 'troubleshoot', input: 'Speed test shows only 1 Mbps', expectRoute: 'search_llm', description: 'Speed test issue'},
  {id: 48, category: 'troubleshoot', input: 'How to reset network settings', expectRoute: 'search_llm', description: 'Network reset'},
  {id: 49, category: 'troubleshoot', input: 'Data not working after traveling', expectRoute: 'search_llm', description: 'Post-travel data issue'},
  {id: 50, category: 'troubleshoot', input: 'My router lights are red', expectRoute: 'search_llm', expectContains: ['router', 'lights'], description: 'Router lights issue'},

  // === STORE LOCATOR (51-60) ===
  {id: 51, category: 'store', input: 'Where is the nearest ACME store?', expectRoute: 'search_llm', expectContains: ['store'], description: 'Nearest store'},
  {id: 52, category: 'store', input: 'ACME store in Cebu', expectRoute: 'search_llm', expectContains: ['Cebu', 'Ayala'], description: 'Cebu store'},
  {id: 53, category: 'store', input: 'Store near SM North EDSA', expectRoute: 'search_llm', expectContains: ['SM North'], description: 'SM North store'},
  {id: 54, category: 'store', input: 'Store hours in Davao', expectRoute: 'search_llm', expectContains: ['Davao'], description: 'Davao store hours'},
  {id: 55, category: 'store', input: 'Is there a ACME store in Iloilo?', expectRoute: 'search_llm', expectContains: ['Iloilo'], description: 'Iloilo store'},
  {id: 56, category: 'store', input: 'BGC store services', expectRoute: 'search_llm', expectContains: ['BGC', 'Bonifacio'], description: 'BGC services'},
  {id: 57, category: 'store', input: 'ACME store Mall of Asia', expectRoute: 'search_llm', expectContains: ['Mall of Asia'], description: 'MOA store'},
  {id: 58, category: 'store', input: 'Store in Baguio', expectRoute: 'search_llm', expectContains: ['Baguio'], description: 'Baguio store'},
  {id: 59, category: 'store', input: 'Where can I get a SIM replacement?', expectRoute: 'search_llm', expectContains: ['SIM replacement'], description: 'SIM replacement location'},
  {id: 60, category: 'store', input: 'ACME store Cagayan de Oro', expectRoute: 'search_llm', expectContains: ['Cagayan'], description: 'CDO store'},

  // === PAYMENT (61-70) ===
  {id: 61, category: 'payment', input: 'How do I pay my bill?', expectRoute: 'search_llm', expectContains: ['pay', 'bill'], description: 'General payment'},
  {id: 62, category: 'payment', input: 'Pay via GCash', expectRoute: 'search_llm', expectContains: ['GCash'], description: 'GCash payment'},
  {id: 63, category: 'payment', input: 'Can I pay at 7-Eleven?', expectRoute: 'search_llm', expectContains: ['7-Eleven'], description: '7-Eleven payment'},
  {id: 64, category: 'payment', input: 'How to set up auto-debit?', expectRoute: 'search_llm', expectContains: ['auto-debit', 'Auto-Debit'], description: 'Auto-debit setup'},
  {id: 65, category: 'payment', input: 'Bank transfer for bill payment', expectRoute: 'search_llm', expectContains: ['bank', 'BDO'], description: 'Bank transfer'},
  {id: 66, category: 'payment', input: 'Where can I buy prepaid load?', expectRoute: 'search_llm', description: 'Buy load'},
  {id: 67, category: 'payment', input: 'Pay using Maya or PayMaya', expectRoute: 'search_llm', expectContains: ['Maya'], description: 'Maya payment'},
  {id: 68, category: 'payment', input: 'Bayad Center bill payment', expectRoute: 'search_llm', expectContains: ['Bayad'], description: 'Bayad payment'},
  {id: 69, category: 'payment', input: 'SM Bills Payment for ACME Telecom', expectRoute: 'search_llm', expectContains: ['SM'], description: 'SM payment'},
  {id: 70, category: 'payment', input: 'Is there a fee for paying at convenience stores?', expectRoute: 'search_llm', expectContains: ['fee', 'PHP'], description: 'Payment fee inquiry'},

  // === ROAMING (71-78) ===
  {id: 71, category: 'roaming', input: 'Roaming rates in Japan', expectRoute: 'search_llm', expectContains: ['Japan', 'Zone B'], description: 'Japan roaming'},
  {id: 72, category: 'roaming', input: 'How much is data roaming in Singapore?', expectRoute: 'search_llm', expectContains: ['Singapore', 'ASEAN'], description: 'Singapore roaming'},
  {id: 73, category: 'roaming', input: 'Roaming packages for ASEAN countries', expectRoute: 'search_llm', expectContains: ['ASEAN', 'Zone A'], description: 'ASEAN packages'},
  {id: 74, category: 'roaming', input: 'I am going to Europe what are my options?', expectRoute: 'search_llm', expectContains: ['Zone C'], description: 'Europe roaming'},
  {id: 75, category: 'roaming', input: 'How to activate roaming?', expectRoute: 'search_llm', expectContains: ['roaming', 'activate'], description: 'Activate roaming'},
  {id: 76, category: 'roaming', input: 'Roaming in Korea and Taiwan', expectRoute: 'search_llm', expectContains: ['Korea', 'Zone B'], description: 'Korea/Taiwan roaming'},
  {id: 77, category: 'roaming', input: 'Cheapest roaming package', expectRoute: 'search_llm', expectContains: ['PHP'], description: 'Cheap roaming'},
  {id: 78, category: 'roaming', input: 'International data while traveling', expectRoute: 'search_llm', description: 'General intl data'},

  // === ACCOUNT/ONLINE-REQUIRED (79-88) ===
  {id: 79, category: 'online', input: 'What is my balance?', expectRoute: 'online_queue', description: 'Balance check (offline)'},
  {id: 80, category: 'online', input: 'Check my data usage', expectRoute: 'online_queue', description: 'Data usage (offline) — matches "my data usage"'},
  {id: 81, category: 'online', input: 'I want to change my plan to Plan 999', expectRoute: 'online_queue', description: 'Plan change (offline)'},
  {id: 82, category: 'online', input: 'What is my bill this month?', expectRoute: 'online_queue', description: 'Bill inquiry (offline)'},
  {id: 83, category: 'online', input: 'Create a support ticket for my issue', expectRoute: 'online_queue', description: 'Ticket creation (offline)'},
  {id: 84, category: 'online', input: 'Is there a service outage in my area?', expectRoute: 'online_queue', description: 'Outage check (offline)'},
  {id: 85, category: 'online', input: 'Check my account details', expectRoute: 'online_queue', description: 'Account details (offline)'},
  {id: 86, category: 'online', input: 'I want to upgrade plan', expectRoute: 'online_queue', description: 'Upgrade plan (offline)'},
  {id: 87, category: 'online', input: 'Switch plan to postpaid', expectRoute: 'online_queue', description: 'Switch plan (offline)'},
  {id: 88, category: 'online', input: 'File a complaint about my bill', expectRoute: 'online_queue', description: 'File complaint (offline)'},

  // === SIM / eSIM (89-94) ===
  {id: 89, category: 'sim', input: 'How do I activate my new SIM?', expectRoute: 'search_llm', expectContains: ['SIM', 'activate'], description: 'New SIM activation'},
  {id: 90, category: 'sim', input: 'How to get an eSIM?', expectRoute: 'search_llm', expectContains: ['eSIM'], description: 'eSIM inquiry'},
  {id: 91, category: 'sim', input: 'Convert physical SIM to eSIM', expectRoute: 'search_llm', expectContains: ['eSIM', 'convert'], description: 'SIM to eSIM conversion'},
  {id: 92, category: 'sim', input: 'Lost my SIM card what do I do?', expectRoute: 'search_llm', expectContains: ['lost', 'SIM', 'replacement'], description: 'Lost SIM'},
  {id: 93, category: 'sim', input: 'How many SIM cards can I register?', expectRoute: 'search_llm', expectContains: ['register', 'SIM'], description: 'SIM registration limit'},
  {id: 94, category: 'sim', input: 'Number porting from Globe to ACME Telecom', expectRoute: 'search_llm', expectContains: ['porting'], description: 'Number porting'},

  // === GENERAL / EDGE CASES (95-100) ===
  {id: 95, category: 'general', input: 'What is your customer service hotline?', expectRoute: 'search_llm', expectContains: ['211'], description: 'Hotline number'},
  {id: 96, category: 'general', input: 'What is ACMEPay?', expectRoute: 'search_llm', expectContains: ['ACMEPay', 'wallet'], description: 'ACMEPay inquiry'},
  {id: 97, category: 'general', input: 'Tell me about quantum physics', expectRoute: 'search_llm', description: 'Off-topic query'},
  {id: 98, category: 'general', input: 'asdfghjkl random gibberish', expectRoute: 'fallback', description: 'Gibberish input'},
  {id: 99, category: 'general', input: 'How do I check my prepaid balance?', expectRoute: 'search_llm', expectContains: ['*123#', 'balance'], description: 'Balance check method (not account-specific)'},
  {id: 100, category: 'general', input: '5G availability in the Philippines', expectRoute: 'search_llm', expectContains: ['5G'], description: '5G inquiry'},
];
