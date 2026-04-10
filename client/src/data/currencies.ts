export interface CurrencyOption {
  value: string;
  label: string;
}

const CURRENCIES: CurrencyOption[] = [
  // Major / most common
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'JPY', label: 'JPY - Japanese Yen' },
  { value: 'CHF', label: 'CHF - Swiss Franc' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
  { value: 'AUD', label: 'AUD - Australian Dollar' },
  { value: 'NZD', label: 'NZD - New Zealand Dollar' },

  // Asia Pacific
  { value: 'PHP', label: 'PHP - Philippine Peso' },
  { value: 'INR', label: 'INR - Indian Rupee' },
  { value: 'IDR', label: 'IDR - Indonesian Rupiah' },
  { value: 'MYR', label: 'MYR - Malaysian Ringgit' },
  { value: 'SGD', label: 'SGD - Singapore Dollar' },
  { value: 'THB', label: 'THB - Thai Baht' },
  { value: 'VND', label: 'VND - Vietnamese Dong' },
  { value: 'BDT', label: 'BDT - Bangladeshi Taka' },
  { value: 'PKR', label: 'PKR - Pakistani Rupee' },
  { value: 'LKR', label: 'LKR - Sri Lankan Rupee' },
  { value: 'NPR', label: 'NPR - Nepalese Rupee' },
  { value: 'CNY', label: 'CNY - Chinese Yuan' },
  { value: 'HKD', label: 'HKD - Hong Kong Dollar' },
  { value: 'TWD', label: 'TWD - Taiwan Dollar' },
  { value: 'KRW', label: 'KRW - South Korean Won' },

  // Europe
  { value: 'SEK', label: 'SEK - Swedish Krona' },
  { value: 'NOK', label: 'NOK - Norwegian Krone' },
  { value: 'DKK', label: 'DKK - Danish Krone' },
  { value: 'PLN', label: 'PLN - Polish Zloty' },
  { value: 'CZK', label: 'CZK - Czech Koruna' },
  { value: 'HUF', label: 'HUF - Hungarian Forint' },
  { value: 'RON', label: 'RON - Romanian Leu' },
  { value: 'BGN', label: 'BGN - Bulgarian Lev' },
  { value: 'HRK', label: 'HRK - Croatian Kuna' },
  { value: 'RUB', label: 'RUB - Russian Ruble' },
  { value: 'UAH', label: 'UAH - Ukrainian Hryvnia' },
  { value: 'TRY', label: 'TRY - Turkish Lira' },

  // Middle East & Africa
  { value: 'AED', label: 'AED - UAE Dirham' },
  { value: 'SAR', label: 'SAR - Saudi Riyal' },
  { value: 'QAR', label: 'QAR - Qatari Riyal' },
  { value: 'KWD', label: 'KWD - Kuwaiti Dinar' },
  { value: 'BHD', label: 'BHD - Bahraini Dinar' },
  { value: 'ILS', label: 'ILS - Israeli Shekel' },
  { value: 'EGP', label: 'EGP - Egyptian Pound' },
  { value: 'ZAR', label: 'ZAR - South African Rand' },
  { value: 'NGN', label: 'NGN - Nigerian Naira' },
  { value: 'KES', label: 'KES - Kenyan Shilling' },
  { value: 'GHS', label: 'GHS - Ghanaian Cedi' },
  { value: 'MAD', label: 'MAD - Moroccan Dirham' },

  // Americas
  { value: 'MXN', label: 'MXN - Mexican Peso' },
  { value: 'BRL', label: 'BRL - Brazilian Real' },
  { value: 'ARS', label: 'ARS - Argentine Peso' },
  { value: 'CLP', label: 'CLP - Chilean Peso' },
  { value: 'COP', label: 'COP - Colombian Peso' },
  { value: 'PEN', label: 'PEN - Peruvian Sol' },
];

export default CURRENCIES;
