import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const authMiddleware = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ message: "No token, authorization denied" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || "your_jwt_secret_key_change_this");
  } catch (error) {
    return res.status(401).json({ message: "Token is not valid" });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, email, created_at FROM admins WHERE id = $1',
      [decoded.admin.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Admin not found" });
    }

    req.admin = result.rows[0];
    next();
  } catch (error) {
    res.status(503).json({ message: "Temporarily unavailable, please try again" });
  }
};

export default authMiddleware;
