//src/routes/messages/ts
import { Router, Request, Response } from "express";
import { graphqlRequest } from "../lib/graphqlClient";
import jwt from "jsonwebtoken";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

const router = Router();

// Your CMS public URL where images are served from
const CMS_BASE_URL = "http://localhost:3001";

// Replace with your actual JWT secret
const AUTH_SECRET = process.env.AUTH_SECRET || "this-is-a-secure-secret";

interface Message {
  id: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    imageUrl?: string;
  };
  replyTo: {
    id: string;
    content: string;
    sender: {
      id:string;
      name: string;
    }
  }
}

// GET /messages/:chatRoomId - fetch messages for a chat room
router.get("/:chatRoomId", async (req: Request, res: Response) => {
  const chatRoomId = req.params.chatRoomId;
  if (!chatRoomId) {
    return res.status(400).json({ error: "chatRoomId parameter is required" });
  }

  try {
    const query = `
  query GetMessages($chatRoomId: IDFilter!) {
    messages(
      where: { chatRoom: { id: $chatRoomId } }
      orderBy: { createdAt: asc }
    ) {
      id
      content
      createdAt
      sender {
        id
        name
        imageUrl
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

    const variables = {
      chatRoomId: { equals: chatRoomId },
    };

    const data = await graphqlRequest<{ messages: Message[] }>(
      query,
      variables
    );

    // Map each message sender's imageUrl to full URL if exists
    const messagesWithFullImageUrl = data.messages.map((msg) => ({
      ...msg,
      sender: {
        ...msg.sender,
        imageUrl: msg.sender.imageUrl
          ? CMS_BASE_URL + msg.sender.imageUrl
          : undefined,
      },
      replyTo: msg.replyTo
        ? {
            id: msg.replyTo.id,
            content: msg.replyTo.content,
            sender: {
              id: msg.replyTo.sender.id,
              name: msg.replyTo.sender.name,
            },
          }
        : undefined,
    }));

    return res.json({ messages: messagesWithFullImageUrl });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
});

// DELETE /messages/:id - delete a message by ID if requester is sender
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  const messageId = req.params.id;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // 1) Check if the user is the sender of the message
    const checkQuery = `
      query CheckSender($messageId: ID!) {
        message(where: { id: $messageId }) {
          id
          sender {
            id
          }
        }
      }
    `;

    const checkResult = await graphqlRequest<{
      message: { sender: { id: string } };
    }>(checkQuery, { messageId });

    if (!checkResult.message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (checkResult.message.sender.id !== userId) {
      return res
        .status(403)
        .json({ error: "You are not the sender of this message" });
    }

    // 2) Delete the message
    const mutation = `
      mutation DeleteMessage($where: MessageWhereUniqueInput!) {
        deleteMessage(where: $where) {
          id
        }
      }
    `;

    const variables = {
      where: { id: messageId },
    };

    const result = await graphqlRequest(mutation, variables);

    res.json({ success: true, deletedId: result.deleteMessage.id });
  } catch (error) {
    console.error("❌ Error deleting message:", error);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

export default router;
