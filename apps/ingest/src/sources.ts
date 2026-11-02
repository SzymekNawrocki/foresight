/** A primary (official statements), B reliable newsroom, C analysis or trade media (ADR 0009). */
export type SourceTier = "A" | "B" | "C";

export interface Source {
  id: string;
  name: string;
  tier: SourceTier;
  url: string;
}

// Public RSS feeds. Only title, link, date and Source are kept (SPEC.md → Slice 02).
// Every new Event costs a Groq call, so a feed is picked for signal over volume (ADR 0009).
// Slice 13 (2026-11-02): general feeds off the Niche removed (Al Jazeera, UN, CNBC, OilPrice,
// ECB, Fed), niche feeds added for the seed Threads. Checked with the bot's user agent that day.
export const SOURCES: readonly Source[] = [
  { id: "white-house-actions", name: "White House: Presidential Actions", tier: "A", url: "https://www.whitehouse.gov/presidential-actions/feed/" },
  { id: "us-dod", name: "U.S. Department of Defense", tier: "A", url: "https://www.defense.gov/DesktopModules/ArticleCS/RSS.ashx?ContentType=9&Site=945&max=20" },
  { id: "eu-council", name: "Council of the EU", tier: "A", url: "https://www.consilium.europa.eu/en/rss/pressreleases.ashx" },
  { id: "cisa", name: "CISA Advisories", tier: "A", url: "https://www.cisa.gov/cybersecurity-advisories/all.xml" },
  { id: "cert-pl", name: "CERT Polska", tier: "A", url: "https://cert.pl/en/rss.xml" },
  { id: "bbc-world", name: "BBC World", tier: "B", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { id: "notes-from-poland", name: "Notes from Poland", tier: "B", url: "https://notesfrompoland.com/feed/" },
  { id: "kyiv-independent", name: "The Kyiv Independent", tier: "B", url: "https://kyivindependent.com/news-archive/rss/" },
  { id: "the-record", name: "The Record", tier: "B", url: "https://therecord.media/feed" },
  { id: "bleepingcomputer", name: "BleepingComputer", tier: "B", url: "https://www.bleepingcomputer.com/feed/" },
  { id: "cyberscoop", name: "CyberScoop", tier: "B", url: "https://cyberscoop.com/feed/" },
  { id: "breaking-defense", name: "Breaking Defense", tier: "B", url: "https://breakingdefense.com/feed/" },
  { id: "defense-news", name: "Defense News", tier: "B", url: "https://www.defensenews.com/arc/outboundfeeds/rss/?outputType=xml" },
  { id: "defensescoop", name: "DefenseScoop", tier: "B", url: "https://defensescoop.com/feed/" },
  { id: "the-war-zone", name: "The War Zone", tier: "B", url: "https://www.twz.com/feed" },
  { id: "spacenews", name: "SpaceNews", tier: "B", url: "https://spacenews.com/feed/" },
  { id: "the-diplomat", name: "The Diplomat", tier: "C", url: "https://thediplomat.com/feed/" },
  { id: "mit-tech-review", name: "MIT Technology Review", tier: "C", url: "https://www.technologyreview.com/feed/" },
  { id: "ee-times", name: "EE Times", tier: "C", url: "https://www.eetimes.com/feed/" },
  // ~60 items a day: tier C keeps it last in the queue, so it only uses budget the A/B Sources left.
  { id: "digitimes", name: "DIGITIMES Asia", tier: "C", url: "https://www.digitimes.com/rss/daily.xml" },
];
