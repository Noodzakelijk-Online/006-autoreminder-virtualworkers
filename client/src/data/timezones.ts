export interface TimezoneOption {
  value: string;
  label: string;
}

const TIMEZONES: TimezoneOption[] = [
  // UTC
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },

  // Americas
  { value: 'America/New_York', label: 'New York (EST/EDT, UTC-5/-4)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT, UTC-6/-5)' },
  { value: 'America/Denver', label: 'Denver (MST/MDT, UTC-7/-6)' },
  { value: 'America/Phoenix', label: 'Phoenix (MST, UTC-7)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT, UTC-8/-7)' },
  { value: 'America/Anchorage', label: 'Anchorage (AKST/AKDT, UTC-9/-8)' },
  { value: 'Pacific/Honolulu', label: 'Honolulu (HST, UTC-10)' },
  { value: 'America/Toronto', label: 'Toronto (EST/EDT, UTC-5/-4)' },
  { value: 'America/Vancouver', label: 'Vancouver (PST/PDT, UTC-8/-7)' },
  { value: 'America/Mexico_City', label: 'Mexico City (CST/CDT, UTC-6/-5)' },
  { value: 'America/Bogota', label: 'Bogota (COT, UTC-5)' },
  { value: 'America/Lima', label: 'Lima (PET, UTC-5)' },
  { value: 'America/Santiago', label: 'Santiago (CLT/CLST, UTC-4/-3)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT/BRST, UTC-3/-2)' },
  { value: 'America/Argentina/Buenos_Aires', label: 'Buenos Aires (ART, UTC-3)' },
  { value: 'America/Caracas', label: 'Caracas (VET, UTC-4)' },

  // Europe
  { value: 'Europe/London', label: 'London (GMT/BST, UTC+0/+1)' },
  { value: 'Europe/Dublin', label: 'Dublin (GMT/IST, UTC+0/+1)' },
  { value: 'Europe/Lisbon', label: 'Lisbon (WET/WEST, UTC+0/+1)' },
  { value: 'Europe/Amsterdam', label: 'Amsterdam (CET/CEST, UTC+1/+2)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET/CEST, UTC+1/+2)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST, UTC+1/+2)' },
  { value: 'Europe/Madrid', label: 'Madrid (CET/CEST, UTC+1/+2)' },
  { value: 'Europe/Rome', label: 'Rome (CET/CEST, UTC+1/+2)' },
  { value: 'Europe/Brussels', label: 'Brussels (CET/CEST, UTC+1/+2)' },
  { value: 'Europe/Zurich', label: 'Zurich (CET/CEST, UTC+1/+2)' },
  { value: 'Europe/Stockholm', label: 'Stockholm (CET/CEST, UTC+1/+2)' },
  { value: 'Europe/Oslo', label: 'Oslo (CET/CEST, UTC+1/+2)' },
  { value: 'Europe/Copenhagen', label: 'Copenhagen (CET/CEST, UTC+1/+2)' },
  { value: 'Europe/Helsinki', label: 'Helsinki (EET/EEST, UTC+2/+3)' },
  { value: 'Europe/Warsaw', label: 'Warsaw (CET/CEST, UTC+1/+2)' },
  { value: 'Europe/Prague', label: 'Prague (CET/CEST, UTC+1/+2)' },
  { value: 'Europe/Vienna', label: 'Vienna (CET/CEST, UTC+1/+2)' },
  { value: 'Europe/Budapest', label: 'Budapest (CET/CEST, UTC+1/+2)' },
  { value: 'Europe/Bucharest', label: 'Bucharest (EET/EEST, UTC+2/+3)' },
  { value: 'Europe/Athens', label: 'Athens (EET/EEST, UTC+2/+3)' },
  { value: 'Europe/Kiev', label: 'Kyiv (EET/EEST, UTC+2/+3)' },
  { value: 'Europe/Moscow', label: 'Moscow (MSK, UTC+3)' },
  { value: 'Europe/Istanbul', label: 'Istanbul (TRT, UTC+3)' },

  // Africa
  { value: 'Africa/Cairo', label: 'Cairo (EET, UTC+2)' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST, UTC+2)' },
  { value: 'Africa/Lagos', label: 'Lagos (WAT, UTC+1)' },
  { value: 'Africa/Nairobi', label: 'Nairobi (EAT, UTC+3)' },
  { value: 'Africa/Casablanca', label: 'Casablanca (WET/WEST, UTC+0/+1)' },
  { value: 'Africa/Accra', label: 'Accra (GMT, UTC+0)' },

  // Middle East
  { value: 'Asia/Dubai', label: 'Dubai (GST, UTC+4)' },
  { value: 'Asia/Riyadh', label: 'Riyadh (AST, UTC+3)' },
  { value: 'Asia/Kuwait', label: 'Kuwait (AST, UTC+3)' },
  { value: 'Asia/Qatar', label: 'Qatar (AST, UTC+3)' },
  { value: 'Asia/Bahrain', label: 'Bahrain (AST, UTC+3)' },
  { value: 'Asia/Tehran', label: 'Tehran (IRST/IRDT, UTC+3:30/+4:30)' },
  { value: 'Asia/Jerusalem', label: 'Jerusalem (IST/IDT, UTC+2/+3)' },
  { value: 'Asia/Beirut', label: 'Beirut (EET/EEST, UTC+2/+3)' },

  // Asia
  { value: 'Asia/Karachi', label: 'Karachi (PKT, UTC+5)' },
  { value: 'Asia/Kolkata', label: 'India (IST, UTC+5:30)' },
  { value: 'Asia/Colombo', label: 'Colombo (IST, UTC+5:30)' },
  { value: 'Asia/Dhaka', label: 'Dhaka (BST, UTC+6)' },
  { value: 'Asia/Kathmandu', label: 'Kathmandu (NPT, UTC+5:45)' },
  { value: 'Asia/Yangon', label: 'Yangon (MMT, UTC+6:30)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (ICT, UTC+7)' },
  { value: 'Asia/Jakarta', label: 'Jakarta (WIB, UTC+7)' },
  { value: 'Asia/Ho_Chi_Minh', label: 'Ho Chi Minh City (ICT, UTC+7)' },
  { value: 'Asia/Phnom_Penh', label: 'Phnom Penh (ICT, UTC+7)' },
  { value: 'Asia/Kuala_Lumpur', label: 'Kuala Lumpur (MYT, UTC+8)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT, UTC+8)' },
  { value: 'Asia/Manila', label: 'Manila / Philippines (PST, UTC+8)' },
  { value: 'Asia/Shanghai', label: 'Shanghai / Beijing (CST, UTC+8)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT, UTC+8)' },
  { value: 'Asia/Taipei', label: 'Taipei (CST, UTC+8)' },
  { value: 'Asia/Seoul', label: 'Seoul (KST, UTC+9)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST, UTC+9)' },
  { value: 'Asia/Makassar', label: 'Makassar / WITA (UTC+8)' },
  { value: 'Asia/Jayapura', label: 'Jayapura / WIT (UTC+9)' },
  { value: 'Asia/Almaty', label: 'Almaty (ALMT, UTC+6)' },
  { value: 'Asia/Tashkent', label: 'Tashkent (UZT, UTC+5)' },

  // Pacific & Oceania
  { value: 'Australia/Perth', label: 'Perth (AWST, UTC+8)' },
  { value: 'Australia/Darwin', label: 'Darwin (ACST, UTC+9:30)' },
  { value: 'Australia/Adelaide', label: 'Adelaide (ACST/ACDT, UTC+9:30/+10:30)' },
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST, UTC+10)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT, UTC+10/+11)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT, UTC+10/+11)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT, UTC+12/+13)' },
  { value: 'Pacific/Fiji', label: 'Fiji (FJT, UTC+12)' },
  { value: 'Pacific/Guam', label: 'Guam (ChST, UTC+10)' },
];

export default TIMEZONES;
