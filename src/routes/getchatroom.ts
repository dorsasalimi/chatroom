import express from "express";
import { graphqlRequest } from "../lib/graphqlClient";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

const router = express.Router();

/**
 * GET /chatrooms
 * Fetch all chat rooms with participants and latest message.
 */
router.get("/", async (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ error: "UNAUTHORIZED" });
  }

  try {
    const query = `
      query GetUserChatRooms($userId: ID!) {
        chatRooms(where: {
          participants: {
            some: {
              id: {
                equals: $userId
              }
            }
          }
        }) {
          id
          name
          participants {
            id
            name
            imageUrl
          }
          messages(orderBy: { createdAt: desc }, take: 1) {
            id
            content
            createdAt
            sender {
              id
              name
              imageUrl
            }
          }
        }
      }
    `;

    const variables = { userId };

    const { chatRooms } = await graphqlRequest(query, variables);

    res.json({ chatRooms });
  } catch (error) {
    console.error("❌ Error fetching chatrooms:", error);
    res.status(500).json({ error: "SERVER_ERROR_FETCHING_CHATROOMS" });
  }
});

/**
 * PATCH /chatrooms/:id
 * Rename a chat room (only if the user is a participant).
 */
router.patch("/:id", async (req: AuthenticatedRequest, res) => {
  const chatRoomId = req.params.id;
  const { name } = req.body;
  const userId = req.user?.id;

  if (!name) return res.status(400).json({ error: "NAME_REQUIRED" });
  if (!userId) return res.status(401).json({ error: "UNAUTHORIZED" });

  try {
    const checkParticipantQuery = `
      query ($chatRoomId: ID!, $userId: ID!) {
        chatRoom(where: { id: $chatRoomId }) {
          participants(where: { id: { equals: $userId } }) {
            id
          }
        }
      }
    `;

    const { chatRoom } = await graphqlRequest(checkParticipantQuery, {
      chatRoomId,
      userId,
    });

    if (!chatRoom || chatRoom.participants.length === 0) {
      return res.status(403).json({ error: "NOT_A_PARTICIPANT" });
    }

    const mutation = `
      mutation ($id: ID!, $name: String!) {
        updateChatRoom(
          where: { id: $id }
          data: { name: $name }
        ) {
          id
          name
        }
      }
    `;

    const result = await graphqlRequest(mutation, { id: chatRoomId, name });

    res.json(result.updateChatRoom);
  } catch (error) {
    console.error("❌ Error renaming chat room:", error);
    res.status(500).json({ error: "SERVER_ERROR_RENAME_CHATROOM" });
  }
});

/**
 * DELETE /chatrooms/:id
 * Delete a chat room (only if the user is a participant).
 */
router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  const chatRoomId = req.params.id;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: "UNAUTHORIZED" });

  try {
    const checkParticipantQuery = `
      query ($chatRoomId: ID!, $userId: ID!) {
        chatRoom(where: { id: $chatRoomId }) {
          participants(where: { id: { equals: $userId } }) {
            id
          }
        }
      }
    `;

    const { chatRoom } = await graphqlRequest(checkParticipantQuery, {
      chatRoomId,
      userId,
    });

    if (!chatRoom || chatRoom.participants.length === 0) {
      return res.status(403).json({ error: "NOT_A_PARTICIPANT" });
    }

    const mutation = `
      mutation ($id: ID!) {
        deleteChatRoom(where: { id: $id }) {
          id
        }
      }
    `;

    const result = await graphqlRequest(mutation, { id: chatRoomId });

    res.json({ success: true, deletedId: result.deleteChatRoom.id });
  } catch (error) {
    console.error("❌ Error deleting chat room:", error);
    res.status(500).json({ error: "SERVER_ERROR_DELETE_CHATROOM" });
  }
});

export default router;
