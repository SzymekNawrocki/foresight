import { type Actor, type Branch, type LegacyTopic, type LikelihoodChange, type Region, type ScenarioKind, type SourceTier, Topic, type Weight } from "@foresight/shared";

// Nazwy z CONTEXT.md — kod trzyma identyfikatory po angielsku, strona mówi po polsku.
export const REGION_LABEL: Record<Region, string> = {
  "north-america": "Ameryka Północna",
  "latin-america": "Ameryka Łacińska",
  europe: "Europa",
  "russia-eurasia": "Rosja i Eurazja",
  "middle-east": "Bliski Wschód",
  africa: "Afryka",
  "asia-pacific": "Azja-Pacyfik",
  global: "Globalne",
};

/** A Topic of the Niche — an old one has no page any more. */
export const isTopic = (t: string): t is Topic => Topic.safeParse(t).success;

// The six Topics of the Niche, plus the old ones still on Events from before slice 12.
export const TOPIC_LABEL: Record<Topic | LegacyTopic, string> = {
  cyber: "Cyber",
  drones: "Drony",
  space: "Kosmos",
  chips: "Chipy",
  ai: "AI",
  "defence-industry": "Zbrojeniówka",
  battlefield: "Pole walki",
  semiconductors: "Półprzewodniki",
  commodities: "Surowce",
  energy: "Energia",
  "sanctions-trade": "Sankcje i handel",
};

export const ACTOR_LABEL: Record<Actor, string> = {
  usa: "USA",
  canada: "Kanada",
  mexico: "Meksyk",
  brazil: "Brazylia",
  venezuela: "Wenezuela",
  uk: "Wielka Brytania",
  germany: "Niemcy",
  france: "Francja",
  italy: "Włochy",
  poland: "Polska",
  ukraine: "Ukraina",
  russia: "Rosja",
  belarus: "Białoruś",
  turkey: "Turcja",
  israel: "Izrael",
  palestine: "Palestyna",
  iran: "Iran",
  iraq: "Irak",
  syria: "Syria",
  "saudi-arabia": "Arabia Saudyjska",
  uae: "ZEA",
  qatar: "Katar",
  egypt: "Egipt",
  india: "Indie",
  pakistan: "Pakistan",
  afghanistan: "Afganistan",
  china: "Chiny",
  taiwan: "Tajwan",
  japan: "Japonia",
  "south-korea": "Korea Południowa",
  "north-korea": "Korea Północna",
  australia: "Australia",
  eu: "UE",
  nato: "NATO",
  un: "ONZ",
  opec: "OPEC",
  g7: "G7",
  brics: "BRICS",
  "african-union": "Unia Afrykańska",
  hamas: "Hamas",
  hezbollah: "Hezbollah",
  houthis: "Huti",
};

export const WEIGHT_LABEL: Record<Weight, string> = { 1: "szum", 2: "istotne", 3: "przełomowe" };

export const DIRECTION_ARROW: Record<Branch["direction"], string> = { up: "↑", down: "↓" };

export const SCENARIO_LABEL: Record<ScenarioKind, string> = {
  escalation: "Eskalacja",
  "status-quo": "Status quo",
  deescalation: "Deeskalacja",
};

export const CHANGE_ARROW: Record<LikelihoodChange, string> = { up: "↑", down: "↓", same: "=", new: "•" };

export const TIER_LABEL: Record<SourceTier, string> = { A: "A · oficjalne", B: "B · redakcja", C: "C · analiza" };
