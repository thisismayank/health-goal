/**
 * Popular hiking destinations shown as one-tap chips on /trails/discover.
 * Each label is a search query that fuzzy-matches trail.region /
 * trail.name; results are just the same search flow, prefilled.
 *
 * Curated — not exhaustive — to give the page a proper empty state
 * ('type or tap one of these') rather than a bare search box.
 */

export type Destination = {
  label: string;
  query: string;
  // Rough hint at what kind of trails to expect. Purely display copy.
  hint?: string;
};

export const POPULAR_DESTINATIONS: Destination[] = [
  { label: "Rainier NP", query: "Rainier NP", hint: "Cascades · WA" },
  { label: "Zion NP", query: "Zion NP", hint: "Utah" },
  { label: "Yosemite NP", query: "Yosemite NP", hint: "Sierra Nevada · CA" },
  { label: "Grand Canyon NP", query: "Grand Canyon NP", hint: "Arizona" },
  { label: "Rocky Mtn NP", query: "Rocky Mtn NP", hint: "Colorado" },
  { label: "Glacier NP", query: "Glacier NP", hint: "Montana" },
  { label: "Acadia NP", query: "Acadia NP", hint: "Maine" },
  { label: "Colorado 14ers", query: "CO", hint: "Front Range + Sawatch + Tenmile" },
  { label: "PNW day hikes", query: "Cascades · WA", hint: "Mailbox, Mt Si, Colchuck" },
  { label: "White Mtns", query: "White Mtns", hint: "New Hampshire" },
  { label: "The Alps", query: "Alps", hint: "France · Italy · Germany" },
  { label: "UK peaks", query: "England", hint: "Snowdon · Scafell · Helvellyn" },
  { label: "Nepal treks", query: "Nepal", hint: "Everest · Annapurna · Langtang" },
  { label: "India Himalaya", query: "India", hint: "Roopkund · Valley of Flowers" },
  { label: "Africa", query: "Kenya", hint: "Kilimanjaro · Meru · Mt Kenya" },
  { label: "Patagonia", query: "Patagonia", hint: "Torres del Paine · Fitz Roy" },
  { label: "NZ great walks", query: "New Zealand", hint: "Tongariro · Milford · Mueller" },
];
