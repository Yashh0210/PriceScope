# Flipkart Product Scraper API( Purely Educational Purpose)

This project is a Node.js + TypeScript Express API that scrapes product details from a Flipkart product page URL.
It exposes a simple endpoint that returns product name, price, rating, and availability as JSON.

## Tech Stack

- Node.js
- TypeScript
- Express
- Playwright (Chromium)

## Install and Run

### 1) Install dependencies

```bash
npm install
```

### 2) Install Playwright browsers

```bash
npm run playwright:install
```

### 3) Run in development

```bash
npm run dev
```

The server starts on:

```text
http://localhost:3000
```

### 4) (Optional) Build and run production

```bash
npm run build
npm start
```

## API Endpoints

### Health Check

- `GET /health`

### Scrape Product

- `GET /scrape?url=<flipkart-product-url>`

If `url` is missing, API returns:

```json
{
  "error": "url query parameter is required"
}
```

## Example API Request and Response

### Request

```http
GET http://localhost:3000/scrape?url=https://www.flipkart.com/apple-iphone-15-black-128-gb/p/itm6ac6485515ae4
```

### Success Response (example)

```json
{
  "name": "Apple iPhone 15 (Black, 128 GB)",
  "price": "₹54,900",
  "rating": "4.6",
  "availability": "In stock"
}
```

### Error Response (example)

```json
{
  "error": "Page failed to load: Flipkart returned an error or blocked the request"
}
```
