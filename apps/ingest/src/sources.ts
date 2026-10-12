export interface Source {
  id: string;
  name: string;
  url: string;
}

// Public RSS feeds, checked 2026-10-12. Only title, link, date and Source are kept (SPEC.md → Slice 02).
export const SOURCES: readonly Source[] = [
  { id: "bbc-world", name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { id: "al-jazeera", name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { id: "cnbc-world", name: "CNBC World", url: "https://www.cnbc.com/id/100727362/device/rss/rss.html" },
  { id: "notes-from-poland", name: "Notes from Poland", url: "https://notesfrompoland.com/feed/" },
];
