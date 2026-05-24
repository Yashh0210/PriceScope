"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const scraper_1 = require("./scraper");
const app = (0, express_1.default)();
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
        const product = await (0, scraper_1.scrapeProduct)(url.trim());
        res.json(product);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : "Scraping failed";
        res.status(500).json({ error: message });
    }
});
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
