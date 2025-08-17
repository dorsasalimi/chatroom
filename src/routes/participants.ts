import { Router, Request, Response } from "express";
import { graphqlRequest } from "../lib/graphqlClient";
import { Server as IOServer } from "socket.io";
import jwt from "jsonwebtoken";

const router = Router();
const AUTH_SECRET = process.env.AUTH_SECRET || "this-is-a-secure-secret";

// Track active users
const activeUsers = new Map<string, Set<string>>(); // chatRoomId -> Set of userIds

// Simple JWT auth for this router
router.use((req: Request, res: Response, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log("[AUTH] No Authorization header");
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.replace("Bearer ", "");
  try {
    const decoded = jwt.verify(token, AUTH_SECRET);
    (req as any).user = decoded;
    next();
  } catch (err) {
    console.log("[AUTH] Invalid token", err);
    return res.status(401).json({ error: "Invalid token" });
  }
});

// Middleware to track active users per chat room
router.use("/:chatRoomId", (req: Request, res: Response, next) => {
  const userId = (req as any).user?.id;
  const { chatRoomId } = req.params;

  console.log(`[ACTIVE USERS] User ${userId} accessing chatRoom ${chatRoomId}`);

  if (userId && chatRoomId) {
    if (!activeUsers.has(chatRoomId)) activeUsers.set(chatRoomId, new Set());
    activeUsers.get(chatRoomId)?.add(userId);

    const io: IOServer = (req as any).app.get("io");
    io?.to(chatRoomId).emit("user-online", { userId });
  }

  next();
});

// GET participants
router.get("/:chatRoomId", async (req: Request, res: Response) => {
  const { chatRoomId } = req.params;
  const token = req.headers.authorization?.replace("Bearer ", "");

  console.log(`[GET] Participants for chatRoom ${chatRoomId}`);

  try {
    const query = `
      query GetParticipants($chatRoomId: ID!) {
        chatRoom(where: { id: $chatRoomId }) {
          participants { id name email }
        }
      }
    `;
    const data = await graphqlRequest(query, { chatRoomId }, token);
    const participants = data.chatRoom?.participants || [];

    const activeUserIds = activeUsers.get(chatRoomId) || new Set();
    const enhancedParticipants = participants.map((p: any) => ({
      ...p,
      isActive: activeUserIds.has(p.id),
    }));

    res.json(enhancedParticipants);
  } catch (err) {
    console.error("[GET] Error fetching participants:", err);
    res.status(500).json({ error: "Failed to get participants" });
  }
});

// POST add participant
router.post("/:chatRoomId", async (req: Request, res: Response) => {
  const { chatRoomId } = req.params;
  const { userId } = req.body;
  const token = req.headers.authorization?.replace("Bearer ", "");

  console.log(`[POST] Add participant ${userId} to chatRoom ${chatRoomId}`);

  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    // Check if user exists
    const userQuery = `
      query GetUser($userId: ID!) {
        user(where: { id: $userId }) { id name email }
      }
    `;
    const userData = await graphqlRequest(userQuery, { userId }, token);
    if (!userData.user) return res.status(404).json({ error: "User not found" });

    // Add participant
    const mutation = `
      mutation AddParticipant($chatRoomId: ID!, $userId: ID!) {
        updateChatRoom(
          where: { id: $chatRoomId }
          data: { participants: { connect: { id: $userId } } }
        ) {
          id
          participants { id name email }
        }
      }
    `;
    const data = await graphqlRequest(mutation, { chatRoomId, userId }, token);

    // Notify clients
    const io: IOServer = (req as any).app.get("io");
    io?.to(chatRoomId).emit("participant-added", {
      chatRoomId,
      participant: userData.user,
    });

    res.json(data.updateChatRoom);
  } catch (err) {
    console.error("[POST] Error adding participant:", err);
    res.status(500).json({ error: "Failed to add participant" });
  }
});

// DELETE remove participant
router.delete("/:chatRoomId/:userId", async (req: Request, res: Response) => {
  const { chatRoomId, userId } = req.params;
  const token = req.headers.authorization?.replace("Bearer ", "");

  console.log(`[DELETE] Remove participant ${userId} from chatRoom ${chatRoomId}`);

  try {
    const mutation = `
      mutation RemoveParticipant($chatRoomId: ID!, $userId: ID!) {
        updateChatRoom(
          where: { id: $chatRoomId }
          data: { participants: { disconnect: { id: $userId } } }
        ) {
          id
          participants { id name }
        }
      }
    `;
    const data = await graphqlRequest(mutation, { chatRoomId, userId }, token);

    // Notify clients
    const io: IOServer = (req as any).app.get("io");
    io?.to(chatRoomId).emit("participant-removed", { chatRoomId, userId });

    // Update active users
    activeUsers.get(chatRoomId)?.delete(userId);

    res.json(data.updateChatRoom);
  } catch (err) {
    console.error("[DELETE] Error removing participant:", err);
    res.status(500).json({ error: "Failed to remove participant" });
  }
});

export default router;
