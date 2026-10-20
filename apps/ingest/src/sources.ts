/** A primary (official statements), B reliable newsroom, C analysis or trade media (ADR 0009). */
export type SourceTier = "A" | "B" | "C";

export interface Source {
  id: string;
  name: string;
  tier: SourceTier;
  url: string;
}

// Public RSS feeds. Only title, link, date and Source are kept (SPEC.md → Slice 02).
// World news checked 2026-10-12; one specialist feed per under-covered Topic added 2026-10-16
// (slice 05), picked for signal over volume because every new Event costs a Groq call.
// Tier A added 2026-10-20 (slice 10): official feeds that answered a bot with RSS, ~15 items a day.
export const SOURCES: readonly Source[] = [
  { id: "white-house-actions", name: "White House: Presidential Actions", tier: "A", url: "https://www.whitehouse.gov/presidential-actions/feed/" },
  { id: "us-dod", name: "U.S. Department of Defense", tier: "A", url: "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=9&Site=945&max=20" },
  { id: "un-press", name: "UN Meetings Coverage and Press Releases", tier: "A", url: "https://press.un.org/en/rss.xml" },
  { id: "un-news", name: "UN News", tier: "A", url: "https://news.un.org/feed/subscribe/en/news/all/rss.xml" },
  { id: "eu-council", name: "Council of the EU", tier: "A", url: "https://www.consilium.europa.eu/en/rss/pressreleases.ashx" },
  { id: "ecb", name: "European Central Bank", tier: "A", url: "https://www.ecb.europa.eu/rss/press.html" },
  { id: "federal-reserve", name: "Federal Reserve", tier: "A", url: "https://www.federalreserve.gov/feeds/press_all.xml" },
  { id: "cisa", name: "CISA Advisories", tier: "A", url: "https://www.cisa.gov/cybersecurity-advisories/all.xml" },
  { id: "bbc-world", name: "BBC World", tier: "B", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { id: "al-jazeera", name: "Al Jazeera", tier: "B", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { id: "cnbc-world", name: "CNBC World", tier: "B", url: "https://www.cnbc.com/id/100727362/device/rss/rss.html" },
  { id: "notes-from-poland", name: "Notes from Poland", tier: "B", url: "https://notesfrompoland.com/feed/" },
  { id: "the-record", name: "The Record", tier: "B", url: "https://therecord.media/feed" },
  { id: "breaking-defense", name: "Breaking Defense", tier: "B", url: "https://breakingdefense.com/feed/" },
  { id: "spacenews", name: "SpaceNews", tier: "B", url: "https://spacenews.com/feed/" },
  { id: "oilprice", name: "OilPrice", tier: "C", url: "https://oilprice.com/rss/main" },
  { id: "the-diplomat", name: "The Diplomat", tier: "C", url: "https://thediplomat.com/feed/" },
  { id: "mit-tech-review", name: "MIT Technology Review", tier: "C", url: "https://www.technologyreview.com/feed/" },
  { id: "ee-times", name: "EE Times", tier: "C", url: "https://www.eetimes.com/feed/" },
];
