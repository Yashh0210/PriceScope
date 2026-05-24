import express from "express";
import { scrapeProduct } from "./scraper";

const app = express();
const PORT = 3000;

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/scrape", async (req, res) => {
  const url = req.query.url;

  if (typeof url !== "string" || !url.trim()) {
    res.status(400).json({ error: "url query parameter is required" });
    return;
  }

  try {
    const product = await scrapeProduct(url.trim());
    res.json(product);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scraping failed";
    res.status(500).json({ error: message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
