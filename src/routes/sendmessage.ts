// src/routes/sendmessage.ts
import { Router, Request, Response } from "express";
import { graphqlRequest } from "../lib/graphqlClient";
import jwt from "jsonwebtoken";
import { Server as SocketIOServer } from "socket.io";

const AUTH_SECRET = process.env.AUTH_SECRET || "this-is-a-secure-secret";
const CMS_BASE_URL = "http://localhost:3001";

/**
 * Factory function so we can inject `io` when mounting this router.
 */
export default function createSendMessageRouter(io: SocketIOServer) {
  const router = Router();

  router.post("/", async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Authorization token missing or malformed." });
    }

    const token = authHeader.split(" ")[1];

    let decoded: any;
    try {
      decoded = jwt.verify(token, AUTH_SECRET);
    } catch (err) {
      return res.status(401).json({ error: "Invalid or expired token." });
    }

    const { chatRoomId, content, senderId, replyToId } = req.body;

    // Enforce senderId must match token
    if (!chatRoomId || !content || !senderId || senderId !== decoded?.id) {
      return res
        .status(400)
        .json({ error: "Missing or invalid fields in request." });
    }

    try {
      const mutation = `
        mutation CreateMessage($data: MessageCreateInput!) {
          createMessage(data: $data) {
            id
            content
            createdAt
            sender {
              id
              name
              imageUrl
            }
            chatRoom {
              id
            }
            replyTo {
              id
              content
              sender {
                id
                name
              }
            }
          }
        }
      `;

      const variables: any = {
        data: {
          content,
          chatRoom: { connect: { id: chatRoomId } },
          sender: { connect: { id: senderId } },
        },
      };

      if (replyToId) {
        variables.data.replyTo = { connect: { id: replyToId } };
      }

      const result = await graphqlRequest(mutation, variables, token);

      if (!result?.createMessage) {
        console.error("❌ createMessage is undefined:", result);
        return res.status(500).json({ error: "Missing createMessage result" });
      }

      const rawMessage = result.createMessage;

      const fullImageUrl = rawMessage.sender.imageUrl
        ? CMS_BASE_URL + rawMessage.sender.imageUrl
        : undefined;

const normalizedMessage = {
  id: rawMessage.id,
  content: rawMessage.content,
  createdAt: rawMessage.createdAt ?? new Date().toISOString(),
  sender: {
    id: rawMessage.sender.id,
    name: rawMessage.sender.name,
    imageUrl: fullImageUrl,
  },
  chatRoomId: rawMessage.chatRoom.id,
  tempId: req.body.tempId, // Include the tempId from the request
  replyTo: rawMessage.replyTo
    ? {
        id: rawMessage.replyTo.id,
        content: rawMessage.replyTo.content,
        sender: {
          id: rawMessage.replyTo.sender.id,
          name: rawMessage.replyTo.sender.name,
        },
      }
    : undefined,
};

      // ✅ Broadcast to everyone in this chat room
      io.to(normalizedMessage.chatRoomId).emit("new-message", normalizedMessage);

      res.json(normalizedMessage);
    } catch (err: any) {
      console.error("Failed to create message:", err);
      res.status(500).json({ error: "Server error creating message." });
    }
  });

  return router;
}
