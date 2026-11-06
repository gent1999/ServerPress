import express from "express";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import auth from "../middleware/auth.js";

const router = express.Router();

let analyticsDataClient;
let initError = null;

try {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
    analyticsDataClient = new BetaAnalyticsDataClient({ credentials });
  } else {
    // Local dev fallback: GOOGLE_APPLICATION_CREDENTIALS pointing at a JSON key file.
    analyticsDataClient = new BetaAnalyticsDataClient();
  }
} catch (error) {
  initError = error.message;
  console.error("❌ Google Analytics client initialization failed:", error.message);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const EMPTY_VISITORS = { current: 0, previous: 0, allTime: 0, average: 0, change: 0, realtime: 0, monthly: [] };

// @route   GET /api/analytics/visitors
// @desc    Monthly/realtime visitor stats for pluggpress.com from GA4
// @access  Private (admin only)
router.get("/visitors", auth, async (req, res) => {
  const propertyId = process.env.GA_PROPERTY_ID;

  if (!analyticsDataClient) {
    return res.status(503).json({
      message: initError ? `Analytics initialization failed: ${initError}` : "Google Analytics not configured",
      visitors: EMPTY_VISITORS,
    });
  }
  if (!propertyId) {
    return res.status(503).json({ message: "GA_PROPERTY_ID not configured", visitors: EMPTY_VISITORS });
  }

  try {
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    const today = new Date();

    const previousMonthStart = new Date(currentMonthStart);
    previousMonthStart.setMonth(previousMonthStart.getMonth() - 1);
    const previousMonthEnd = new Date(currentMonthStart);
    previousMonthEnd.setDate(0);

    const [currentMonthResponse, previousMonthResponse, allTimeResponse, monthlyResponse, realtimeResponse] = await Promise.all([
      analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: formatDate(currentMonthStart), endDate: "today" }],
        metrics: [{ name: "activeUsers" }],
      }),
      analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: formatDate(previousMonthStart), endDate: formatDate(previousMonthEnd) }],
        metrics: [{ name: "activeUsers" }],
      }),
      analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: "2020-01-01", endDate: "today" }],
        metrics: [{ name: "activeUsers" }],
      }),
      analyticsDataClient.runReport({
        property: `properties/${propertyId}`,
        dateRanges: [{ startDate: "2020-01-01", endDate: "today" }],
        dimensions: [{ name: "yearMonth" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ dimension: { dimensionName: "yearMonth" } }],
        limit: 120,
      }),
      analyticsDataClient.runRealtimeReport({
        property: `properties/${propertyId}`,
        metrics: [{ name: "activeUsers" }],
      }),
    ]);

    const currentMonthVisitors = parseInt(currentMonthResponse[0].rows?.[0]?.metricValues?.[0]?.value || 0);
    const previousMonthVisitors = parseInt(previousMonthResponse[0].rows?.[0]?.metricValues?.[0]?.value || 0);
    const allTimeVisitors = parseInt(allTimeResponse[0].rows?.[0]?.metricValues?.[0]?.value || 0);
    const realtimeVisitors = parseInt(realtimeResponse[0].rows?.[0]?.metricValues?.[0]?.value || 0);

    const monthlyRows = (monthlyResponse[0].rows || [])
      .map((row) => {
        const yearMonth = row.dimensionValues?.[0]?.value || "";
        const year = yearMonth.slice(0, 4);
        const month = yearMonth.slice(4, 6);
        const date = year && month ? `${year}-${month}-01` : null;
        return {
          yearMonth,
          date,
          label: date ? new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { month: "short", year: "2-digit" }) : yearMonth,
          visitors: parseInt(row.metricValues?.[0]?.value || 0),
        };
      })
      .filter((p) => p.yearMonth)
      .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

    let averageMonthly = 0;
    if (monthlyRows.length > 0) {
      averageMonthly = Math.round(monthlyRows.reduce((sum, p) => sum + p.visitors, 0) / monthlyRows.length);
    }

    let change = 0;
    if (previousMonthVisitors > 0) {
      change = ((currentMonthVisitors - previousMonthVisitors) / previousMonthVisitors) * 100;
    }

    res.json({
      visitors: {
        current: currentMonthVisitors,
        previous: previousMonthVisitors,
        allTime: allTimeVisitors,
        average: averageMonthly,
        change: Math.round(change * 10) / 10,
        realtime: realtimeVisitors,
        monthly: monthlyRows,
      },
    });
  } catch (error) {
    console.error("Error fetching analytics data:", error.message);
    res.status(500).json({ message: "Error fetching analytics data", error: error.message, visitors: EMPTY_VISITORS });
  }
});

export default router;
