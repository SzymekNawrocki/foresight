export interface Source {
  id: string;
  name: string;
  url: string;
}

// Public RSS feeds. Only title, link, date and Source are kept (SPEC.md → Slice 02).
// World news checked 2026-10-12; one specialist feed per under-covered Topic added 2026-10-16
// (slice 05), picked for signal over volume because every new Event costs a Groq call.
export const SOURCES: readonly Source[] = [
  { id: "bbc-world", name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { id: "al-jazeera", name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { id: "cnbc-world", name: "CNBC World", url: "https://www.cnbc.com/id/100727362/device/rss/rss.html" },
  { id: "notes-from-poland", name: "Notes from Poland", url: "https://notesfrompoland.com/feed/" },
  { id: "the-record", name: "The Record", url: "https://therecord.media/feed" },
  { id: "breaking-defense", name: "Breaking Defense", url: "https://breakingdefense.com/feed/" },
  { id: "spacenews", name: "SpaceNews", url: "https://spacenews.com/feed/" },
  { id: "oilprice", name: "OilPrice", url: "https://oilprice.com/rss/main" },
  { id: "the-diplomat", name: "The Diplomat", url: "https://thediplomat.com/feed/" },
  { id: "mit-tech-review", name: "MIT Technology Review", url: "https://www.technologyreview.com/feed/" },
  { id: "ee-times", name: "EE Times", url: "https://www.eetimes.com/feed/" },
];
