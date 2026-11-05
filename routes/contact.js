import express from 'express';
import pool from '../config/db.js';
import { sendContactNotification } from '../utils/email.js';

const router = express.Router();

let tableReady = false;
async function ensureTable() {
  if (tableReady || !pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS leads (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      service TEXT,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  tableReady = true;
}

router.post('/', async (req, res) => {
  const { name, email, service, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ message: 'Name, email, and message are required.' });
  }

  if (!pool) {
    // DB isn't wired up yet — log so the lead isn't lost, but don't fail the request.
    console.log('📬 New PluggPress lead (no DB configured):', { name, email, service, message });
    // Must be awaited, not fire-and-forget -- on Vercel's serverless runtime
    // the function execution can freeze the instant the response is sent,
    // killing any still-in-flight (un-awaited) network call before it completes.
    await sendContactNotification({ name, email, service, message }).catch((err) => console.error('Contact email error:', err.message));
    return res.json({ message: 'Message received.' });
  }

  try {
    await ensureTable();
    await pool.query(
      `INSERT INTO leads (name, email, service, message) VALUES ($1, $2, $3, $4)`,
      [name, email, service || null, message]
    );
    await sendContactNotification({ name, email, service, message }).catch((err) => console.error('Contact email error:', err.message));
    res.json({ message: 'Message received.' });
  } catch (error) {
    console.error('Error saving lead:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
