import { Router, Request, Response } from "express";
import { graphqlRequest } from "../lib/graphqlClient";

const router = Router();

interface Message {
  id: string;
  content: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    chatRoomId: string;
  };
}

router.get("/:chatRoomId", async (req: Request, res: Response) => {
  const chatRoomId = req.params.chatRoomId;
  if (!chatRoomId) {
    return res.status(400).json({ error: "chatRoomId parameter is required" });
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;

  try {
    const query = `
      query GetMessages($chatRoomId: IDFilter!) {
        messages(where: { chatRoom: { id: $chatRoomId } }, orderBy: { createdAt: asc }) {
          id
          content
          createdAt
          sender { id name }
        }
      }
    `;

    const variables = {
      chatRoomId: { equals: chatRoomId },
    };

    const data = await graphqlRequest<{ messages: Message[] }>(
      query,
      variables,
      token
    );

    console.log("Fetched messages:", data.messages);

    return res.json({ messages: data.messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
});

export default router;
