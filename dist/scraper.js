"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScrapeError = void 0;
exports.scrapeProduct = scrapeProduct;
const playwright_1 = require("playwright");
class ScrapeError extends Error {
    constructor(message) {
        super(message);
        this.name = "ScrapeError";
    }
}
exports.ScrapeError = ScrapeError;
const NAVIGATION_TIMEOUT_MS = 45000;
const PRODUCT_SELECTOR_TIMEOUT_MS = 20000;
const REALISTIC_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const FALLBACK = "N/A";
const FLIPKART_SELECTORS = {
    name: "span.VU-ZEz",
    price: "div.Nx9bqj",
    rating: "div.XQDdHH",
    outOfStock: 'div[class*="out-of-stock"], div[class*="OutOfStock"], div[class*="outOfStock"]',
};
function randomDelayMs(minMs, maxMs) {
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}
async function scrapeProduct(url) {
    const browser = await playwright_1.chromium.launch({
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
        ],
    });
    try {
        const context = await browser.newContext({
            userAgent: REALISTIC_USER_AGENT,
            locale: "en-IN",
            viewport: { width: 1280, height: 720 },
        });
        await context.addInitScript(() => {
            Object.defineProperty(navigator, "webdriver", {
                get: () => false,
                configurable: true,
            });
        });
        const page = await context.newPage();
        let response;
        try {
            response = await page.goto(url, {
                waitUntil: "domcontentloaded",
                timeout: NAVIGATION_TIMEOUT_MS,
            });
        }
        catch (error) {
            throw new ScrapeError(`Page failed to load: navigation timed out or was aborted for ${url}`);
        }
        if (!response) {
            throw new ScrapeError(`Page failed to load: no response received for ${url}`);
        }
        if (!response.ok()) {
            throw new ScrapeError(`Page failed to load: HTTP ${response.status()} ${response.statusText()}`);
        }
        await dismissLoginModal(page);
        await waitForProductContent(page);
        if (await isBlockedOrErrorPage(page)) {
            throw new ScrapeError("Page failed to load: Flipkart returned an error or blocked the request");
        }
        await page.waitForTimeout(randomDelayMs(2000, 4000));
        const fromJsonLd = await extractFromJsonLd(page);
        const fromDom = await extractFromDom(page);
        return {
            name: fromJsonLd.name || fromDom.name,
            price: fromJsonLd.price || fromDom.price,
            rating: fromJsonLd.rating || fromDom.rating,
            availability: fromJsonLd.availability || fromDom.availability,
        };
    }
    finally {
        await browser.close();
    }
}
async function dismissLoginModal(page) {
    const closeSelectors = [
        "button._2KpZ6l._2doB4z",
        'button:has-text("✕")',
        '[aria-label="Close"]',
    ];
    for (const selector of closeSelectors) {
        const button = page.locator(selector).first();
        if (await button.isVisible({ timeout: 1500 }).catch(() => false)) {
            await button.click({ timeout: 3000 }).catch(() => undefined);
            break;
        }
    }
}
async function waitForProductContent(page) {
    const productLocator = page.locator(`${FLIPKART_SELECTORS.name}, ${FLIPKART_SELECTORS.price}, script[type="application/ld+json"]`);
    try {
        await productLocator.first().waitFor({
            state: "attached",
            timeout: PRODUCT_SELECTOR_TIMEOUT_MS,
        });
    }
    catch (error) {
        throw new ScrapeError("Page failed to load: product content did not appear in time");
    }
}
async function isBlockedOrErrorPage(page) {
    const bodyText = await page.locator("body").innerText();
    const title = await page.title();
    return (/\bE002\b/i.test(bodyText) ||
        /something went wrong/i.test(bodyText) ||
        /access denied|captcha|robot/i.test(bodyText) ||
        (title.includes("Flipkart.com") && !bodyText.includes("₹") && !bodyText.match(/\d\.\d/)));
}
async function extractFromJsonLd(page) {
    const scripts = await page
        .locator('script[type="application/ld+json"]')
        .allTextContents();
    for (const raw of scripts) {
        try {
            const parsed = JSON.parse(raw);
            const nodes = Array.isArray(parsed) ? parsed : [parsed];
            for (const node of nodes) {
                if (!node || typeof node !== "object")
                    continue;
                const record = node;
                const type = record["@type"];
                const isProduct = type === "Product" ||
                    (Array.isArray(type) && type.includes("Product")) ||
                    (typeof type === "string" && type.includes("Product"));
                if (!isProduct)
                    continue;
                return mapSchemaProduct(record);
            }
        }
        catch {
            continue;
        }
    }
    return {};
}
function mapSchemaProduct(record) {
    const offers = record.offers;
    const aggregateRating = record.aggregateRating;
    const priceValue = offers?.price ??
        (Array.isArray(offers)
            ? offers[0]?.price
            : undefined);
    const availabilityRaw = offers?.availability ??
        (Array.isArray(offers)
            ? offers[0]?.availability
            : undefined);
    return {
        name: typeof record.name === "string" ? record.name.trim() : undefined,
        price: priceValue != null ? String(priceValue).trim() : undefined,
        rating: aggregateRating?.ratingValue != null
            ? String(aggregateRating.ratingValue).trim()
            : undefined,
        availability: formatSchemaAvailability(availabilityRaw),
    };
}
function formatSchemaAvailability(value) {
    if (value == null)
        return undefined;
    const text = String(value);
    if (/InStock/i.test(text))
        return "In stock";
    if (/OutOfStock/i.test(text))
        return "Out of stock";
    if (/PreOrder/i.test(text))
        return "Pre-order";
    if (/LimitedAvailability/i.test(text))
        return "Limited availability";
    return text.replace(/^https?:\/\/schema\.org\//i, "").trim() || undefined;
}
async function extractFromDom(page) {
    const name = await getFieldText(page, FLIPKART_SELECTORS.name);
    const price = await getFieldText(page, FLIPKART_SELECTORS.price);
    const rating = await getFieldText(page, FLIPKART_SELECTORS.rating);
    const availability = await getAvailability(page);
    return { name, price, rating, availability };
}
async function getFieldText(page, selector) {
    const text = await page
        .locator(selector)
        .first()
        .textContent({ timeout: 5000 })
        .catch(() => null);
    const trimmed = text?.trim();
    return trimmed ? trimmed : FALLBACK;
}
async function getAvailability(page) {
    const outOfStockCount = await page
        .locator(FLIPKART_SELECTORS.outOfStock)
        .count();
    if (outOfStockCount > 0) {
        return "Out of stock";
    }
    const hasProductMarker = await page
        .locator(`${FLIPKART_SELECTORS.name}, ${FLIPKART_SELECTORS.price}`)
        .first()
        .isVisible()
        .catch(() => false);
    return hasProductMarker ? "In stock" : FALLBACK;
}
