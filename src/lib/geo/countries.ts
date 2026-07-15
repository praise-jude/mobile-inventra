// Reference data only (ISO-3166 country list + ISO-4217 currency mapping) —
// no external API calls needed for the country → state → currency dropdowns.
// State/province lists are only filled in for markets where a dependent
// dropdown is worth showing; everywhere else `states` is empty and the UI
// falls back to no state selector.

export interface Country {
  code: string;
  name: string;
  currency: string;
  states: string[];
  timezone: string;
}

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
  "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina",
  "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island",
  "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming",
  "District of Columbia",
];

const CANADA_PROVINCES = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador",
  "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island",
  "Quebec", "Saskatchewan", "Yukon",
];

const NIGERIA_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "Gombe", "Imo", "Jigawa",
  "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger",
  "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe",
  "Zamfara", "Federal Capital Territory",
];

const GHANA_REGIONS = [
  "Ahafo", "Ashanti", "Bono", "Bono East", "Central", "Eastern", "Greater Accra",
  "North East", "Northern", "Oti", "Savannah", "Upper East", "Upper West", "Volta",
  "Western", "Western North",
];

const KENYA_COUNTIES = [
  "Baringo", "Bomet", "Bungoma", "Busia", "Elgeyo-Marakwet", "Embu", "Garissa", "Homa Bay",
  "Isiolo", "Kajiado", "Kakamega", "Kericho", "Kiambu", "Kilifi", "Kirinyaga", "Kisii",
  "Kisumu", "Kitui", "Kwale", "Laikipia", "Lamu", "Machakos", "Makueni", "Mandera", "Marsabit",
  "Meru", "Migori", "Mombasa", "Murang'a", "Nairobi", "Nakuru", "Nandi", "Narok", "Nyamira",
  "Nyandarua", "Nyeri", "Samburu", "Siaya", "Taita-Taveta", "Tana River", "Tharaka-Nithi",
  "Trans Nzoia", "Turkana", "Uasin Gishu", "Vihiga", "Wajir", "West Pokot",
];

const SOUTH_AFRICA_PROVINCES = [
  "Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga",
  "Northern Cape", "North West", "Western Cape",
];

const UK_NATIONS = ["England", "Scotland", "Wales", "Northern Ireland"];

const INDIA_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
  "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh",
  "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
  "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh",
  "Lakshadweep", "Puducherry",
];

const AUSTRALIA_STATES = [
  "New South Wales", "Queensland", "South Australia", "Tasmania", "Victoria",
  "Western Australia", "Australian Capital Territory", "Northern Territory",
];

const GERMANY_STATES = [
  "Baden-Württemberg", "Bavaria", "Berlin", "Brandenburg", "Bremen", "Hamburg", "Hesse",
  "Lower Saxony", "Mecklenburg-Vorpommern", "North Rhine-Westphalia", "Rhineland-Palatinate",
  "Saarland", "Saxony", "Saxony-Anhalt", "Schleswig-Holstein", "Thuringia",
];

const BRAZIL_STATES = [
  "Acre", "Alagoas", "Amapá", "Amazonas", "Bahia", "Ceará", "Distrito Federal",
  "Espírito Santo", "Goiás", "Maranhão", "Mato Grosso", "Mato Grosso do Sul", "Minas Gerais",
  "Pará", "Paraíba", "Paraná", "Pernambuco", "Piauí", "Rio de Janeiro",
  "Rio Grande do Norte", "Rio Grande do Sul", "Rondônia", "Roraima", "Santa Catarina",
  "São Paulo", "Sergipe", "Tocantins",
];

const MEXICO_STATES = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas",
  "Chihuahua", "Ciudad de México", "Coahuila", "Colima", "Durango", "Guanajuato",
  "Guerrero", "Hidalgo", "Jalisco", "México", "Michoacán", "Morelos", "Nayarit",
  "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí",
  "Sinaloa", "Sonora", "Tabasco", "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán",
  "Zacatecas",
];

const UAE_EMIRATES = [
  "Abu Dhabi", "Ajman", "Dubai", "Fujairah", "Ras Al Khaimah", "Sharjah", "Umm Al Quwain",
];

const TANZANIA_REGIONS = [
  "Arusha", "Dar es Salaam", "Dodoma", "Geita", "Iringa", "Kagera", "Katavi", "Kigoma",
  "Kilimanjaro", "Lindi", "Manyara", "Mara", "Mbeya", "Morogoro", "Mtwara", "Mwanza",
  "Njombe", "Pemba North", "Pemba South", "Pwani", "Rukwa", "Ruvuma", "Shinyanga",
  "Simiyu", "Singida", "Songwe", "Tabora", "Tanga", "Unguja North", "Unguja South",
  "Zanzibar Urban/West",
];

const UGANDA_REGIONS = ["Central", "Eastern", "Northern", "Western"];

const EGYPT_GOVERNORATES = [
  "Alexandria", "Aswan", "Asyut", "Beheira", "Beni Suef", "Cairo", "Dakahlia", "Damietta",
  "Faiyum", "Gharbia", "Giza", "Ismailia", "Kafr El Sheikh", "Luxor", "Matrouh", "Minya",
  "Monufia", "New Valley", "North Sinai", "Port Said", "Qalyubia", "Qena", "Red Sea",
  "Sharqia", "Sohag", "South Sinai", "Suez",
];

const PAKISTAN_PROVINCES = [
  "Balochistan", "Khyber Pakhtunkhwa", "Punjab", "Sindh", "Azad Kashmir",
  "Gilgit-Baltistan", "Islamabad Capital Territory",
];

const FRANCE_REGIONS = [
  "Auvergne-Rhône-Alpes", "Bourgogne-Franche-Comté", "Brittany", "Centre-Val de Loire",
  "Corsica", "Grand Est", "Hauts-de-France", "Île-de-France", "Normandy",
  "Nouvelle-Aquitaine", "Occitanie", "Pays de la Loire", "Provence-Alpes-Côte d'Azur",
];

const ITALY_REGIONS = [
  "Abruzzo", "Aosta Valley", "Apulia", "Basilicata", "Calabria", "Campania",
  "Emilia-Romagna", "Friuli-Venezia Giulia", "Lazio", "Liguria", "Lombardy", "Marche",
  "Molise", "Piedmont", "Sardinia", "Sicily", "Trentino-Alto Adige", "Tuscany", "Umbria",
  "Veneto",
];

const SPAIN_REGIONS = [
  "Andalusia", "Aragon", "Asturias", "Balearic Islands", "Basque Country", "Canary Islands",
  "Cantabria", "Castile and León", "Castilla-La Mancha", "Catalonia", "Extremadura",
  "Galicia", "La Rioja", "Madrid", "Murcia", "Navarre", "Valencian Community", "Ceuta",
  "Melilla",
];

const NETHERLANDS_PROVINCES = [
  "Drenthe", "Flevoland", "Friesland", "Gelderland", "Groningen", "Limburg",
  "North Brabant", "North Holland", "Overijssel", "South Holland", "Utrecht", "Zeeland",
];

const PHILIPPINES_REGIONS = [
  "Ilocos Region", "Cagayan Valley", "Central Luzon", "Calabarzon", "Mimaropa",
  "Bicol Region", "Western Visayas", "Central Visayas", "Eastern Visayas",
  "Zamboanga Peninsula", "Northern Mindanao", "Davao Region", "Soccsksargen", "Caraga",
  "Bangsamoro", "Cordillera Administrative Region", "National Capital Region",
];

const INDONESIA_PROVINCES = [
  "Aceh", "Bali", "Bangka Belitung Islands", "Banten", "Bengkulu", "Central Java",
  "Central Kalimantan", "Central Sulawesi", "East Java", "East Kalimantan",
  "East Nusa Tenggara", "Gorontalo", "Jakarta", "Jambi", "Lampung", "Maluku",
  "North Kalimantan", "North Maluku", "North Sulawesi", "North Sumatra", "Papua",
  "Riau", "Riau Islands", "South Kalimantan", "South Sulawesi", "South Sumatra",
  "Southeast Sulawesi", "West Java", "West Kalimantan", "West Nusa Tenggara",
  "West Papua", "West Sulawesi", "West Sumatra", "Yogyakarta",
];

const NEW_ZEALAND_REGIONS = [
  "Auckland", "Bay of Plenty", "Canterbury", "Gisborne", "Hawke's Bay", "Manawatū-Whanganui",
  "Marlborough", "Nelson", "Northland", "Otago", "Southland", "Taranaki", "Tasman",
  "Waikato", "Wellington", "West Coast",
];

const IRELAND_COUNTIES = [
  "Carlow", "Cavan", "Clare", "Cork", "Donegal", "Dublin", "Galway", "Kerry", "Kildare",
  "Kilkenny", "Laois", "Leitrim", "Limerick", "Longford", "Louth", "Mayo", "Meath",
  "Monaghan", "Offaly", "Roscommon", "Sligo", "Tipperary", "Waterford", "Westmeath",
  "Wexford", "Wicklow",
];

const SAUDI_REGIONS = [
  "Riyadh", "Makkah", "Madinah", "Qassim", "Eastern Province", "Asir", "Tabuk", "Hail",
  "Northern Borders", "Jazan", "Najran", "Al Bahah", "Al Jouf",
];

const CAMEROON_REGIONS = [
  "Adamawa", "Centre", "East", "Far North", "Littoral", "North", "Northwest", "West",
  "South", "Southwest",
];

const COTE_DIVOIRE_DISTRICTS = [
  "Abidjan", "Bas-Sassandra", "Comoé", "Denguélé", "Gôh-Djiboua", "Lacs", "Lagunes",
  "Montagnes", "Sassandra-Marahoué", "Savanes", "Vallée du Bandama", "Woroba", "Yamoussoukro",
  "Zanzan",
];

const RWANDA_PROVINCES = ["Kigali", "Northern", "Southern", "Eastern", "Western"];

const ETHIOPIA_REGIONS = [
  "Addis Ababa", "Afar", "Amhara", "Benishangul-Gumuz", "Dire Dawa", "Gambela", "Harari",
  "Oromia", "Sidama", "Somali", "South West Ethiopia Peoples", "Southern Nations", "Tigray",
];

// Primary IANA zone per country (the capital/most-populous zone) — most
// businesses operate from a single zone. STATE_TIMEZONE_OVERRIDES below
// refines the handful of countries where state actually changes the zone.
const TIMEZONE_BY_CODE: Record<string, string> = {
  AF: "Asia/Kabul", AL: "Europe/Tirane", DZ: "Africa/Algiers", AD: "Europe/Andorra",
  AO: "Africa/Luanda", AR: "America/Argentina/Buenos_Aires", AM: "Asia/Yerevan",
  AU: "Australia/Sydney", AT: "Europe/Vienna", AZ: "Asia/Baku", BS: "America/Nassau",
  BH: "Asia/Bahrain", BD: "Asia/Dhaka", BB: "America/Barbados", BY: "Europe/Minsk",
  BE: "Europe/Brussels", BZ: "America/Belize", BJ: "Africa/Porto-Novo", BT: "Asia/Thimphu",
  BO: "America/La_Paz", BA: "Europe/Sarajevo", BW: "Africa/Gaborone", BR: "America/Sao_Paulo",
  BN: "Asia/Brunei", BG: "Europe/Sofia", BF: "Africa/Ouagadougou", BI: "Africa/Bujumbura",
  KH: "Asia/Phnom_Penh", CM: "Africa/Douala", CA: "America/Toronto", CV: "Atlantic/Cape_Verde",
  CF: "Africa/Bangui", TD: "Africa/Ndjamena", CL: "America/Santiago", CN: "Asia/Shanghai",
  CO: "America/Bogota", KM: "Indian/Comoro", CG: "Africa/Brazzaville", CD: "Africa/Kinshasa",
  CR: "America/Costa_Rica", CI: "Africa/Abidjan", HR: "Europe/Zagreb", CU: "America/Havana",
  CY: "Asia/Nicosia", CZ: "Europe/Prague", DK: "Europe/Copenhagen", DJ: "Africa/Djibouti",
  DM: "America/Dominica", DO: "America/Santo_Domingo", EC: "America/Guayaquil",
  EG: "Africa/Cairo", SV: "America/El_Salvador", GQ: "Africa/Malabo", ER: "Africa/Asmara",
  EE: "Europe/Tallinn", SZ: "Africa/Mbabane", ET: "Africa/Addis_Ababa", FJ: "Pacific/Fiji",
  FI: "Europe/Helsinki", FR: "Europe/Paris", GA: "Africa/Libreville", GM: "Africa/Banjul",
  GE: "Asia/Tbilisi", DE: "Europe/Berlin", GH: "Africa/Accra", GR: "Europe/Athens",
  GD: "America/Grenada", GT: "America/Guatemala", GN: "Africa/Conakry", GW: "Africa/Bissau",
  GY: "America/Guyana", HT: "America/Port-au-Prince", HN: "America/Tegucigalpa",
  HK: "Asia/Hong_Kong", HU: "Europe/Budapest", IS: "Atlantic/Reykjavik", IN: "Asia/Kolkata",
  ID: "Asia/Jakarta", IR: "Asia/Tehran", IQ: "Asia/Baghdad", IE: "Europe/Dublin",
  IL: "Asia/Jerusalem", IT: "Europe/Rome", JM: "America/Jamaica", JP: "Asia/Tokyo",
  JO: "Asia/Amman", KZ: "Asia/Almaty", KE: "Africa/Nairobi", KI: "Pacific/Tarawa",
  KW: "Asia/Kuwait", KG: "Asia/Bishkek", LA: "Asia/Vientiane", LV: "Europe/Riga",
  LB: "Asia/Beirut", LS: "Africa/Maseru", LR: "Africa/Monrovia", LY: "Africa/Tripoli",
  LI: "Europe/Vaduz", LT: "Europe/Vilnius", LU: "Europe/Luxembourg", MO: "Asia/Macau",
  MG: "Indian/Antananarivo", MW: "Africa/Blantyre", MY: "Asia/Kuala_Lumpur",
  MV: "Indian/Maldives", ML: "Africa/Bamako", MT: "Europe/Malta", MR: "Africa/Nouakchott",
  MU: "Indian/Mauritius", MX: "America/Mexico_City", MD: "Europe/Chisinau", MC: "Europe/Monaco",
  MN: "Asia/Ulaanbaatar", ME: "Europe/Podgorica", MA: "Africa/Casablanca",
  MZ: "Africa/Maputo", MM: "Asia/Yangon", NA: "Africa/Windhoek", NR: "Pacific/Nauru",
  NP: "Asia/Kathmandu", NL: "Europe/Amsterdam", NZ: "Pacific/Auckland",
  NI: "America/Managua", NE: "Africa/Niamey", NG: "Africa/Lagos", KP: "Asia/Pyongyang",
  MK: "Europe/Skopje", NO: "Europe/Oslo", OM: "Asia/Muscat", PK: "Asia/Karachi",
  PA: "America/Panama", PG: "Pacific/Port_Moresby", PY: "America/Asuncion",
  PE: "America/Lima", PH: "Asia/Manila", PL: "Europe/Warsaw", PT: "Europe/Lisbon",
  QA: "Asia/Qatar", RO: "Europe/Bucharest", RU: "Europe/Moscow", RW: "Africa/Kigali",
  WS: "Pacific/Apia", SM: "Europe/San_Marino", SA: "Asia/Riyadh", SN: "Africa/Dakar",
  RS: "Europe/Belgrade", SC: "Indian/Mahe", SL: "Africa/Freetown", SG: "Asia/Singapore",
  SK: "Europe/Bratislava", SI: "Europe/Ljubljana", SB: "Pacific/Guadalcanal",
  SO: "Africa/Mogadishu", ZA: "Africa/Johannesburg", KR: "Asia/Seoul", SS: "Africa/Juba",
  ES: "Europe/Madrid", LK: "Asia/Colombo", SD: "Africa/Khartoum", SR: "America/Paramaribo",
  SE: "Europe/Stockholm", CH: "Europe/Zurich", SY: "Asia/Damascus", TW: "Asia/Taipei",
  TJ: "Asia/Dushanbe", TZ: "Africa/Dar_es_Salaam", TH: "Asia/Bangkok", TL: "Asia/Dili",
  TG: "Africa/Lome", TO: "Pacific/Tongatapu", TT: "America/Port_of_Spain",
  TN: "Africa/Tunis", TR: "Europe/Istanbul", TM: "Asia/Ashgabat", UG: "Africa/Kampala",
  UA: "Europe/Kyiv", AE: "Asia/Dubai", GB: "Europe/London", US: "America/New_York",
  UY: "America/Montevideo", UZ: "Asia/Tashkent", VU: "Pacific/Efate", VA: "Europe/Vatican",
  VE: "America/Caracas", VN: "Asia/Ho_Chi_Minh", YE: "Asia/Aden", ZM: "Africa/Lusaka",
  ZW: "Africa/Harare",
};

// Only the handful of countries where picking a state actually changes the
// zone — everywhere else the country-level default above is correct.
const STATE_TIMEZONE_OVERRIDES: Record<string, Record<string, string>> = {
  US: {
    Alaska: "America/Anchorage", Arizona: "America/Phoenix", California: "America/Los_Angeles",
    Colorado: "America/Denver", Hawaii: "Pacific/Honolulu", Idaho: "America/Boise",
    Montana: "America/Denver", Nevada: "America/Los_Angeles", "New Mexico": "America/Denver",
    Oregon: "America/Los_Angeles", Utah: "America/Denver", Washington: "America/Los_Angeles",
    Wyoming: "America/Denver", Texas: "America/Chicago", Illinois: "America/Chicago",
    "North Dakota": "America/Chicago", "South Dakota": "America/Chicago", Nebraska: "America/Chicago",
    Kansas: "America/Chicago", Oklahoma: "America/Chicago", Minnesota: "America/Chicago",
    Iowa: "America/Chicago", Missouri: "America/Chicago", Arkansas: "America/Chicago",
    Louisiana: "America/Chicago", Wisconsin: "America/Chicago", Alabama: "America/Chicago",
    Mississippi: "America/Chicago", Tennessee: "America/Chicago",
  },
  CA: {
    "British Columbia": "America/Vancouver", Alberta: "America/Edmonton",
    Saskatchewan: "America/Regina", Manitoba: "America/Winnipeg",
    "Newfoundland and Labrador": "America/St_Johns", Yukon: "America/Whitehorse",
    "Northwest Territories": "America/Yellowknife", Nunavut: "America/Iqaluit",
  },
  AU: {
    "Western Australia": "Australia/Perth", "South Australia": "Australia/Adelaide",
    "Northern Territory": "Australia/Darwin", Queensland: "Australia/Brisbane",
    Tasmania: "Australia/Hobart",
  },
};

export function timezoneFor(countryCode: string, state?: string): string {
  const override = state && STATE_TIMEZONE_OVERRIDES[countryCode]?.[state];
  if (override) return override;
  return TIMEZONE_BY_CODE[countryCode] ?? "UTC";
}

const RAW_COUNTRIES: Omit<Country, "timezone">[] = [
  { code: "AF", name: "Afghanistan", currency: "AFN", states: [] },
  { code: "AL", name: "Albania", currency: "ALL", states: [] },
  { code: "DZ", name: "Algeria", currency: "DZD", states: [] },
  { code: "AD", name: "Andorra", currency: "EUR", states: [] },
  { code: "AO", name: "Angola", currency: "AOA", states: [] },
  { code: "AR", name: "Argentina", currency: "ARS", states: [] },
  { code: "AM", name: "Armenia", currency: "AMD", states: [] },
  { code: "AU", name: "Australia", currency: "AUD", states: AUSTRALIA_STATES },
  { code: "AT", name: "Austria", currency: "EUR", states: [] },
  { code: "AZ", name: "Azerbaijan", currency: "AZN", states: [] },
  { code: "BS", name: "Bahamas", currency: "BSD", states: [] },
  { code: "BH", name: "Bahrain", currency: "BHD", states: [] },
  { code: "BD", name: "Bangladesh", currency: "BDT", states: [] },
  { code: "BB", name: "Barbados", currency: "BBD", states: [] },
  { code: "BY", name: "Belarus", currency: "BYN", states: [] },
  { code: "BE", name: "Belgium", currency: "EUR", states: [] },
  { code: "BZ", name: "Belize", currency: "BZD", states: [] },
  { code: "BJ", name: "Benin", currency: "XOF", states: [] },
  { code: "BT", name: "Bhutan", currency: "BTN", states: [] },
  { code: "BO", name: "Bolivia", currency: "BOB", states: [] },
  { code: "BA", name: "Bosnia and Herzegovina", currency: "BAM", states: [] },
  { code: "BW", name: "Botswana", currency: "BWP", states: [] },
  { code: "BR", name: "Brazil", currency: "BRL", states: BRAZIL_STATES },
  { code: "BN", name: "Brunei", currency: "BND", states: [] },
  { code: "BG", name: "Bulgaria", currency: "BGN", states: [] },
  { code: "BF", name: "Burkina Faso", currency: "XOF", states: [] },
  { code: "BI", name: "Burundi", currency: "BIF", states: [] },
  { code: "KH", name: "Cambodia", currency: "KHR", states: [] },
  { code: "CM", name: "Cameroon", currency: "XAF", states: CAMEROON_REGIONS },
  { code: "CA", name: "Canada", currency: "CAD", states: CANADA_PROVINCES },
  { code: "CV", name: "Cabo Verde", currency: "CVE", states: [] },
  { code: "CF", name: "Central African Republic", currency: "XAF", states: [] },
  { code: "TD", name: "Chad", currency: "XAF", states: [] },
  { code: "CL", name: "Chile", currency: "CLP", states: [] },
  { code: "CN", name: "China", currency: "CNY", states: [] },
  { code: "CO", name: "Colombia", currency: "COP", states: [] },
  { code: "KM", name: "Comoros", currency: "KMF", states: [] },
  { code: "CG", name: "Congo", currency: "XAF", states: [] },
  { code: "CD", name: "Congo (DRC)", currency: "CDF", states: [] },
  { code: "CR", name: "Costa Rica", currency: "CRC", states: [] },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF", states: COTE_DIVOIRE_DISTRICTS },
  { code: "HR", name: "Croatia", currency: "EUR", states: [] },
  { code: "CU", name: "Cuba", currency: "CUP", states: [] },
  { code: "CY", name: "Cyprus", currency: "EUR", states: [] },
  { code: "CZ", name: "Czechia", currency: "CZK", states: [] },
  { code: "DK", name: "Denmark", currency: "DKK", states: [] },
  { code: "DJ", name: "Djibouti", currency: "DJF", states: [] },
  { code: "DM", name: "Dominica", currency: "XCD", states: [] },
  { code: "DO", name: "Dominican Republic", currency: "DOP", states: [] },
  { code: "EC", name: "Ecuador", currency: "USD", states: [] },
  { code: "EG", name: "Egypt", currency: "EGP", states: EGYPT_GOVERNORATES },
  { code: "SV", name: "El Salvador", currency: "USD", states: [] },
  { code: "GQ", name: "Equatorial Guinea", currency: "XAF", states: [] },
  { code: "ER", name: "Eritrea", currency: "ERN", states: [] },
  { code: "EE", name: "Estonia", currency: "EUR", states: [] },
  { code: "SZ", name: "Eswatini", currency: "SZL", states: [] },
  { code: "ET", name: "Ethiopia", currency: "ETB", states: ETHIOPIA_REGIONS },
  { code: "FJ", name: "Fiji", currency: "FJD", states: [] },
  { code: "FI", name: "Finland", currency: "EUR", states: [] },
  { code: "FR", name: "France", currency: "EUR", states: FRANCE_REGIONS },
  { code: "GA", name: "Gabon", currency: "XAF", states: [] },
  { code: "GM", name: "Gambia", currency: "GMD", states: [] },
  { code: "GE", name: "Georgia", currency: "GEL", states: [] },
  { code: "DE", name: "Germany", currency: "EUR", states: GERMANY_STATES },
  { code: "GH", name: "Ghana", currency: "GHS", states: GHANA_REGIONS },
  { code: "GR", name: "Greece", currency: "EUR", states: [] },
  { code: "GD", name: "Grenada", currency: "XCD", states: [] },
  { code: "GT", name: "Guatemala", currency: "GTQ", states: [] },
  { code: "GN", name: "Guinea", currency: "GNF", states: [] },
  { code: "GW", name: "Guinea-Bissau", currency: "XOF", states: [] },
  { code: "GY", name: "Guyana", currency: "GYD", states: [] },
  { code: "HT", name: "Haiti", currency: "HTG", states: [] },
  { code: "HN", name: "Honduras", currency: "HNL", states: [] },
  { code: "HK", name: "Hong Kong", currency: "HKD", states: [] },
  { code: "HU", name: "Hungary", currency: "HUF", states: [] },
  { code: "IS", name: "Iceland", currency: "ISK", states: [] },
  { code: "IN", name: "India", currency: "INR", states: INDIA_STATES },
  { code: "ID", name: "Indonesia", currency: "IDR", states: INDONESIA_PROVINCES },
  { code: "IR", name: "Iran", currency: "IRR", states: [] },
  { code: "IQ", name: "Iraq", currency: "IQD", states: [] },
  { code: "IE", name: "Ireland", currency: "EUR", states: IRELAND_COUNTIES },
  { code: "IL", name: "Israel", currency: "ILS", states: [] },
  { code: "IT", name: "Italy", currency: "EUR", states: ITALY_REGIONS },
  { code: "JM", name: "Jamaica", currency: "JMD", states: [] },
  { code: "JP", name: "Japan", currency: "JPY", states: [] },
  { code: "JO", name: "Jordan", currency: "JOD", states: [] },
  { code: "KZ", name: "Kazakhstan", currency: "KZT", states: [] },
  { code: "KE", name: "Kenya", currency: "KES", states: KENYA_COUNTIES },
  { code: "KI", name: "Kiribati", currency: "AUD", states: [] },
  { code: "KW", name: "Kuwait", currency: "KWD", states: [] },
  { code: "KG", name: "Kyrgyzstan", currency: "KGS", states: [] },
  { code: "LA", name: "Laos", currency: "LAK", states: [] },
  { code: "LV", name: "Latvia", currency: "EUR", states: [] },
  { code: "LB", name: "Lebanon", currency: "LBP", states: [] },
  { code: "LS", name: "Lesotho", currency: "LSL", states: [] },
  { code: "LR", name: "Liberia", currency: "LRD", states: [] },
  { code: "LY", name: "Libya", currency: "LYD", states: [] },
  { code: "LI", name: "Liechtenstein", currency: "CHF", states: [] },
  { code: "LT", name: "Lithuania", currency: "EUR", states: [] },
  { code: "LU", name: "Luxembourg", currency: "EUR", states: [] },
  { code: "MO", name: "Macao", currency: "MOP", states: [] },
  { code: "MG", name: "Madagascar", currency: "MGA", states: [] },
  { code: "MW", name: "Malawi", currency: "MWK", states: [] },
  { code: "MY", name: "Malaysia", currency: "MYR", states: [] },
  { code: "MV", name: "Maldives", currency: "MVR", states: [] },
  { code: "ML", name: "Mali", currency: "XOF", states: [] },
  { code: "MT", name: "Malta", currency: "EUR", states: [] },
  { code: "MR", name: "Mauritania", currency: "MRU", states: [] },
  { code: "MU", name: "Mauritius", currency: "MUR", states: [] },
  { code: "MX", name: "Mexico", currency: "MXN", states: MEXICO_STATES },
  { code: "MD", name: "Moldova", currency: "MDL", states: [] },
  { code: "MC", name: "Monaco", currency: "EUR", states: [] },
  { code: "MN", name: "Mongolia", currency: "MNT", states: [] },
  { code: "ME", name: "Montenegro", currency: "EUR", states: [] },
  { code: "MA", name: "Morocco", currency: "MAD", states: [] },
  { code: "MZ", name: "Mozambique", currency: "MZN", states: [] },
  { code: "MM", name: "Myanmar", currency: "MMK", states: [] },
  { code: "NA", name: "Namibia", currency: "NAD", states: [] },
  { code: "NR", name: "Nauru", currency: "AUD", states: [] },
  { code: "NP", name: "Nepal", currency: "NPR", states: [] },
  { code: "NL", name: "Netherlands", currency: "EUR", states: NETHERLANDS_PROVINCES },
  { code: "NZ", name: "New Zealand", currency: "NZD", states: NEW_ZEALAND_REGIONS },
  { code: "NI", name: "Nicaragua", currency: "NIO", states: [] },
  { code: "NE", name: "Niger", currency: "XOF", states: [] },
  { code: "NG", name: "Nigeria", currency: "NGN", states: NIGERIA_STATES },
  { code: "KP", name: "North Korea", currency: "KPW", states: [] },
  { code: "MK", name: "North Macedonia", currency: "MKD", states: [] },
  { code: "NO", name: "Norway", currency: "NOK", states: [] },
  { code: "OM", name: "Oman", currency: "OMR", states: [] },
  { code: "PK", name: "Pakistan", currency: "PKR", states: PAKISTAN_PROVINCES },
  { code: "PA", name: "Panama", currency: "PAB", states: [] },
  { code: "PG", name: "Papua New Guinea", currency: "PGK", states: [] },
  { code: "PY", name: "Paraguay", currency: "PYG", states: [] },
  { code: "PE", name: "Peru", currency: "PEN", states: [] },
  { code: "PH", name: "Philippines", currency: "PHP", states: PHILIPPINES_REGIONS },
  { code: "PL", name: "Poland", currency: "PLN", states: [] },
  { code: "PT", name: "Portugal", currency: "EUR", states: [] },
  { code: "QA", name: "Qatar", currency: "QAR", states: [] },
  { code: "RO", name: "Romania", currency: "RON", states: [] },
  { code: "RU", name: "Russia", currency: "RUB", states: [] },
  { code: "RW", name: "Rwanda", currency: "RWF", states: RWANDA_PROVINCES },
  { code: "WS", name: "Samoa", currency: "WST", states: [] },
  { code: "SM", name: "San Marino", currency: "EUR", states: [] },
  { code: "SA", name: "Saudi Arabia", currency: "SAR", states: SAUDI_REGIONS },
  { code: "SN", name: "Senegal", currency: "XOF", states: [] },
  { code: "RS", name: "Serbia", currency: "RSD", states: [] },
  { code: "SC", name: "Seychelles", currency: "SCR", states: [] },
  { code: "SL", name: "Sierra Leone", currency: "SLE", states: [] },
  { code: "SG", name: "Singapore", currency: "SGD", states: [] },
  { code: "SK", name: "Slovakia", currency: "EUR", states: [] },
  { code: "SI", name: "Slovenia", currency: "EUR", states: [] },
  { code: "SB", name: "Solomon Islands", currency: "SBD", states: [] },
  { code: "SO", name: "Somalia", currency: "SOS", states: [] },
  { code: "ZA", name: "South Africa", currency: "ZAR", states: SOUTH_AFRICA_PROVINCES },
  { code: "KR", name: "South Korea", currency: "KRW", states: [] },
  { code: "SS", name: "South Sudan", currency: "SSP", states: [] },
  { code: "ES", name: "Spain", currency: "EUR", states: SPAIN_REGIONS },
  { code: "LK", name: "Sri Lanka", currency: "LKR", states: [] },
  { code: "SD", name: "Sudan", currency: "SDG", states: [] },
  { code: "SR", name: "Suriname", currency: "SRD", states: [] },
  { code: "SE", name: "Sweden", currency: "SEK", states: [] },
  { code: "CH", name: "Switzerland", currency: "CHF", states: [] },
  { code: "SY", name: "Syria", currency: "SYP", states: [] },
  { code: "TW", name: "Taiwan", currency: "TWD", states: [] },
  { code: "TJ", name: "Tajikistan", currency: "TJS", states: [] },
  { code: "TZ", name: "Tanzania", currency: "TZS", states: TANZANIA_REGIONS },
  { code: "TH", name: "Thailand", currency: "THB", states: [] },
  { code: "TL", name: "Timor-Leste", currency: "USD", states: [] },
  { code: "TG", name: "Togo", currency: "XOF", states: [] },
  { code: "TO", name: "Tonga", currency: "TOP", states: [] },
  { code: "TT", name: "Trinidad and Tobago", currency: "TTD", states: [] },
  { code: "TN", name: "Tunisia", currency: "TND", states: [] },
  { code: "TR", name: "Turkey", currency: "TRY", states: [] },
  { code: "TM", name: "Turkmenistan", currency: "TMT", states: [] },
  { code: "UG", name: "Uganda", currency: "UGX", states: UGANDA_REGIONS },
  { code: "UA", name: "Ukraine", currency: "UAH", states: [] },
  { code: "AE", name: "United Arab Emirates", currency: "AED", states: UAE_EMIRATES },
  { code: "GB", name: "United Kingdom", currency: "GBP", states: UK_NATIONS },
  { code: "US", name: "United States", currency: "USD", states: US_STATES },
  { code: "UY", name: "Uruguay", currency: "UYU", states: [] },
  { code: "UZ", name: "Uzbekistan", currency: "UZS", states: [] },
  { code: "VU", name: "Vanuatu", currency: "VUV", states: [] },
  { code: "VA", name: "Vatican City", currency: "EUR", states: [] },
  { code: "VE", name: "Venezuela", currency: "VES", states: [] },
  { code: "VN", name: "Vietnam", currency: "VND", states: [] },
  { code: "YE", name: "Yemen", currency: "YER", states: [] },
  { code: "ZM", name: "Zambia", currency: "ZMW", states: [] },
  { code: "ZW", name: "Zimbabwe", currency: "ZWL", states: [] },
];

export const COUNTRIES: Country[] = RAW_COUNTRIES.map((c) => ({
  ...c,
  timezone: TIMEZONE_BY_CODE[c.code] ?? "UTC",
}));

const BY_CODE: Record<string, Country> = Object.fromEntries(COUNTRIES.map((c) => [c.code, c]));

export function currencyForCountry(code: string): string | undefined {
  return BY_CODE[code]?.currency;
}

export function statesForCountry(code: string): string[] {
  return BY_CODE[code]?.states ?? [];
}

export function isKnownCountry(code: string): boolean {
  return code in BY_CODE;
}

export function countryName(code: string): string {
  return BY_CODE[code]?.name ?? code;
}

// For the Settings manual-override Select — every zone this dataset can
// possibly resolve to, deduplicated and sorted.
export const IANA_TIMEZONES: string[] = Array.from(
  new Set([
    ...Object.values(TIMEZONE_BY_CODE),
    ...Object.values(STATE_TIMEZONE_OVERRIDES).flatMap((byState) => Object.values(byState)),
  ]),
).sort();

export const CURRENCY_CODES: string[] = Array.from(new Set(COUNTRIES.map((c) => c.currency))).sort();
