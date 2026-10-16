import type { Branch, Region, Topic, Weight } from "@foresight/shared";

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

export const TOPIC_LABEL: Record<Topic, string> = {
  cyber: "Cyber",
  ai: "AI",
  battlefield: "Pole walki",
  space: "Kosmos",
  semiconductors: "Półprzewodniki",
  commodities: "Surowce",
  energy: "Energia",
  "sanctions-trade": "Sankcje i handel",
};

export const WEIGHT_LABEL: Record<Weight, string> = { 1: "szum", 2: "istotne", 3: "przełomowe" };

export const DIRECTION_ARROW: Record<Branch["direction"], string> = { up: "↑", down: "↓" };
