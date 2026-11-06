import express from "express";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import contactRoutes from "./routes/contact.js";
import authRoutes from "./routes/auth.js";
import leadsRoutes from "./routes/leads.js";
import authMiddleware from "./middleware/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5100;

// ── CORS ─────────────────────────────────────────────────────────────────────
// Only our own frontends are allowed to call this API from a browser.
const ALLOWED_ORIGINS = [
  'https://pluggpress.com',
  'https://www.pluggpress.com',
  'https://pluggpress.vercel.app',
  // Allow localhost in dev
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:4173',
];

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Cache-Control', 'no-store');
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
});

// Contact form: 5 submissions per hour per IP
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many submissions, please try again later.' },
});

// Admin login: 10 attempts per 15 minutes per IP, to slow down brute-forcing.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts, please try again later.' },
});

app.use(express.json());

app.get("/", (req, res) => {
  res.send("ServerPress is running 🚀");
});

app.use("/api/contact", contactLimiter, contactRoutes);
app.use("/api/auth/login", loginLimiter);
// /me and /registration-status need the admin to already be verified;
// /register and /login must stay public (there's no token to check yet).
app.use("/api/auth", (req, res, next) => {
  if (req.path === '/me') {
    return authMiddleware(req, res, next);
  }
  next();
}, authRoutes);
app.use("/api/leads", leadsRoutes);

app.listen(PORT, () => {
  console.log(`✅ ServerPress listening on port ${PORT}`);
});
