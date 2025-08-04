import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const AUTH_SECRET = process.env.AUTH_SECRET || "this-is-a-secure-secret";
if (!AUTH_SECRET) {
  throw new Error("AUTH_SECRET is not defined in environment variables.");
}

interface JWTPayload {
  id: string;
  name: string;
  role?: {
    id: string;
    name: string;
    permissions: { name: string }[];
  };
  iat?: number;
  exp?: number;
}

export interface AuthenticatedRequest extends Request {
  user?: JWTPayload;
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  console.log("🪪 Headers received:", req.headers);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Unauthorized: Missing or malformed Authorization header",
    });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, AUTH_SECRET) as JWTPayload;
    req.user = decoded;
    console.log("✅ Decoded user from token:", decoded);
    next();
  } catch (err) {
    console.error("❌ JWT verification failed:", err);
    return res.status(401).json({ error: "Invalid token" });
  }
}
