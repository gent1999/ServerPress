import express from "express";
import { google } from "googleapis";
import auth from "../middleware/auth.js";

const router = express.Router();

let searchConsole;
let initError = null;

try {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    const googleAuth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
    searchConsole = google.searchconsole({ version: "v1", auth: googleAuth });
  } else {
    // Local dev fallback: GOOGLE_APPLICATION_CREDENTIALS pointing at a JSON key file.
    const googleAuth = new google.auth.GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
    });
    searchConsole = google.searchconsole({ version: "v1", auth: googleAuth });
  }
} catch (error) {
  initError = error.message;
  console.error("❌ Google Search Console initialization failed:", error.message);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function last28Days() {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 28);
  return { startDate: formatDate(startDate), endDate: formatDate(endDate) };
}

function notConfigured(res, extra) {
  return res.status(503).json({
    message: initError ? `Search Console initialization failed: ${initError}` : "Google Search Console not configured",
    ...extra,
  });
}

// @route   GET /api/search-console/performance
// @desc    Overall clicks/impressions/CTR/position for pluggpress.com, last 28 days
// @access  Private (admin only)
router.get("/performance", auth, async (req, res) => {
  const EMPTY = { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  if (!searchConsole) return notConfigured(res, { performance: EMPTY });

  const siteUrl = process.env.GSC_SITE_URL;
  if (!siteUrl) return res.status(503).json({ message: "GSC_SITE_URL not configured", performance: EMPTY });

  try {
    const { startDate, endDate } = last28Days();
    const response = await searchConsole.searchanalytics.query({
      siteUrl,
      requestBody: { startDate, endDate, dimensions: [], rowLimit: 1 },
    });

    const data = response.data.rows?.[0] || {};
    res.json({
      performance: {
        clicks: Math.round(data.clicks || 0),
        impressions: Math.round(data.impressions || 0),
        ctr: Math.round((data.ctr || 0) * 1000) / 10,
        position: Math.round((data.position || 0) * 10) / 10,
      },
    });
  } catch (error) {
    console.error("Error fetching Search Console performance:", error.message);
    res.status(500).json({ message: "Error fetching search console data", error: error.message, performance: EMPTY });
  }
});

// @route   GET /api/search-console/top-queries
// @desc    Top 10 search queries, last 28 days
// @access  Private (admin only)
router.get("/top-queries", auth, async (req, res) => {
  if (!searchConsole) return notConfigured(res, { queries: [] });

  const siteUrl = process.env.GSC_SITE_URL;
  if (!siteUrl) return res.status(503).json({ message: "GSC_SITE_URL not configured", queries: [] });

  try {
    const { startDate, endDate } = last28Days();
    const response = await searchConsole.searchanalytics.query({
      siteUrl,
      requestBody: { startDate, endDate, dimensions: ["query"], rowLimit: 10 },
    });

    const queries = (response.data.rows || []).map((row) => ({
      query: row.keys[0],
      clicks: Math.round(row.clicks || 0),
      impressions: Math.round(row.impressions || 0),
      ctr: Math.round((row.ctr || 0) * 1000) / 10,
      position: Math.round((row.position || 0) * 10) / 10,
    }));

    res.json({ queries });
  } catch (error) {
    console.error("Error fetching top queries:", error.message);
    res.status(500).json({ message: "Error fetching top queries", error: error.message, queries: [] });
  }
});

// @route   GET /api/search-console/top-pages
// @desc    Top 10 pages, last 28 days
// @access  Private (admin only)
router.get("/top-pages", auth, async (req, res) => {
  if (!searchConsole) return notConfigured(res, { pages: [] });

  const siteUrl = process.env.GSC_SITE_URL;
  if (!siteUrl) return res.status(503).json({ message: "GSC_SITE_URL not configured", pages: [] });

  try {
    const { startDate, endDate } = last28Days();
    const response = await searchConsole.searchanalytics.query({
      siteUrl,
      requestBody: { startDate, endDate, dimensions: ["page"], rowLimit: 10 },
    });

    const pages = (response.data.rows || []).map((row) => ({
      page: row.keys[0],
      clicks: Math.round(row.clicks || 0),
      impressions: Math.round(row.impressions || 0),
      ctr: Math.round((row.ctr || 0) * 1000) / 10,
      position: Math.round((row.position || 0) * 10) / 10,
    }));

    res.json({ pages });
  } catch (error) {
    console.error("Error fetching top pages:", error.message);
    res.status(500).json({ message: "Error fetching top pages", error: error.message, pages: [] });
  }
});

export default router;
