// Sri Lanka Full Moon Poya days and public holidays.
// Source: the "Public and Bank Holidays for the Year 2027" gazette (No. 2493/05 of 16 June 2026)
// and the government calendars. Poya days are common holidays for everyone.
//
//   type "poya"    = Full Moon Poya Day
//   type "holiday" = public and bank holiday  (merc: true = also a mercantile holiday)
//
// When the government announces the next year's holidays, add them here
// (or use the .holiday add command in WhatsApp).
export const HOLIDAYS = [
  // ----- 2026 (the rest of the year) -----
  { date: "2026-11-24", type: "poya", name: "Il Full Moon Poya Day", si: "ඉල් පොහොය" },
  { date: "2026-12-23", type: "poya", name: "Unduvap Full Moon Poya Day", si: "උන්දුවප් පොහොය" },
  { date: "2026-12-25", type: "holiday", name: "Christmas Day", merc: true },

  // ----- 2027 -----
  { date: "2027-01-15", type: "holiday", name: "Tamil Thai Pongal Day", merc: true },
  { date: "2027-01-22", type: "poya", name: "Duruthu Full Moon Poya Day", si: "දුරුතු පොහොය" },
  { date: "2027-02-04", type: "holiday", name: "Independence Day", merc: true },
  { date: "2027-02-20", type: "poya", name: "Navam Full Moon Poya Day", si: "නවම් පොහොය" },
  { date: "2027-03-06", type: "holiday", name: "Mahasivarathri Day" },
  { date: "2027-03-10", type: "holiday", name: "Id-Ul-Fitre (Ramazan Festival Day)" },
  { date: "2027-03-22", type: "poya", name: "Medin Full Moon Poya Day", si: "මැදින් පොහොය" },
  { date: "2027-03-26", type: "holiday", name: "Good Friday" },
  { date: "2027-04-13", type: "holiday", name: "Day Prior to Sinhala & Tamil New Year Day", merc: true },
  { date: "2027-04-14", type: "holiday", name: "Sinhala & Tamil New Year Day", merc: true },
  { date: "2027-04-20", type: "poya", name: "Bak Full Moon Poya Day", si: "බක් පොහොය" },
  { date: "2027-05-01", type: "holiday", name: "May Day", merc: true },
  { date: "2027-05-17", type: "holiday", name: "Id-Ul-Alha (Hadji Festival Day)" },
  { date: "2027-05-19", type: "poya", name: "Vesak Full Moon Poya Day", si: "වෙසක් පොහොය" },
  { date: "2027-05-20", type: "holiday", name: "Day following Vesak Full Moon Poya Day", merc: true },
  { date: "2027-06-18", type: "poya", name: "Poson Full Moon Poya Day", si: "පොසොන් පොහොය" },
  { date: "2027-07-18", type: "poya", name: "Esala Full Moon Poya Day", si: "ඇසළ පොහොය" },
  { date: "2027-08-15", type: "holiday", name: "Milad-Un-Nabi (Holy Prophet's Birthday)", merc: true },
  { date: "2027-08-16", type: "poya", name: "Nikini Full Moon Poya Day", si: "නිකිණි පොහොය" },
  { date: "2027-09-15", type: "poya", name: "Binara Full Moon Poya Day", si: "බිනර පොහොය" },
  { date: "2027-10-15", type: "poya", name: "Vap Full Moon Poya Day", si: "වප් පොහොය" },
  { date: "2027-10-28", type: "holiday", name: "Deepavali Festival Day" },
  { date: "2027-11-13", type: "poya", name: "Il Full Moon Poya Day", si: "ඉල් පොහොය" },
  { date: "2027-12-13", type: "poya", name: "Unduvap Full Moon Poya Day", si: "උන්දුවප් පොහොය" },
  { date: "2027-12-25", type: "holiday", name: "Christmas Day", merc: true },
];