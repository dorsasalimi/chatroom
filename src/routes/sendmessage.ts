import { Router, Request, Response } from "express";
import { graphqlRequest } from "../lib/graphqlClient"; // your existing client

const router = Router();

router.post("/", async (req: Request, res: Response) => {
  const { chatRoomId, content, senderId } = req.body;

  if (!chatRoomId || !content || !senderId) {
    return res.status(400).json({ error: "Missing fields in request." });
  }

  try {
    const mutation = `
      mutation CreateMessage($data: MessageCreateInput!) {
        createMessage(data: $data) {
          id
          content
          createdAt
          sender { id name }
          chatRoom { id }
        }
      }
    `;

    const variables = {
      data: {
        content,
        chatRoom: { connect: { id: chatRoomId } },
        sender: { connect: { id: senderId } },
      },
    };

    const result = await graphqlRequest(mutation, variables);

    const rawMessage = result.data.createMessage;
    const normalizedMessage = {
      id: rawMessage.id,
      content: rawMessage.content,
      createdAt: rawMessage.createdAt,
      sender: rawMessage.sender,
      chatRoomId: rawMessage.chatRoom.id, // flatten this
    };

    res.json(normalizedMessage);
  } catch (err: any) {
    console.error("Failed to create message:", err);
    res.status(500).json({ error: "Server error creating message." });
  }
});


export default router;
