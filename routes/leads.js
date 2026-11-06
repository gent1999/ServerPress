import express from 'express';
import pool from '../config/db.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// @route   GET /api/leads
// @desc    List contact form submissions, newest first
// @access  Private (admin only)
router.get('/', auth, async (req, res) => {
  if (!pool) {
    return res.json({ leads: [] });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, service, message, created_at FROM leads ORDER BY created_at DESC LIMIT 200`
    );
    res.json({ leads: result.rows });
  } catch (error) {
    // leads table may not exist yet if no one has submitted the contact form.
    if (error.code === '42P01') {
      return res.json({ leads: [] });
    }
    console.error('Error fetching leads:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/leads/:id
// @desc    Delete a lead
// @access  Private (admin only)
router.delete('/:id', auth, async (req, res) => {
  if (!pool) {
    return res.status(404).json({ message: 'Lead not found' });
  }

  try {
    const result = await pool.query('DELETE FROM leads WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Lead not found' });
    }
    res.json({ message: 'Lead deleted' });
  } catch (error) {
    console.error('Error deleting lead:', error.message);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
