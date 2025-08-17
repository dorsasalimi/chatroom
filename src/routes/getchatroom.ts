//src/routes/getchatroom.ts
import express from "express";
import { graphqlRequest } from "../lib/graphqlClient";
import { AuthenticatedRequest } from "../middleware/authMiddleware";

interface AuthenticatedAppRequest extends AuthenticatedRequest {
  app: any; // Changed from optional to required
}

const router = express.Router();

/**
 * GET /chatrooms
 * Fetch all chat rooms with participants and latest message.
 */
router.get("/", async (req: AuthenticatedAppRequest, res) => {
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
router.patch("/:id", async (req: AuthenticatedAppRequest, res) => {
  const chatRoomId = req.params.id;
  const { name } = req.body;
  const userId = req.user?.id;

  if (!name) return res.status(400).json({ error: "NAME_REQUIRED" });
  if (!userId) return res.status(401).json({ error: "UNAUTHORIZED" });

  try {
    // First check if user is a participant
    const checkParticipantQuery = `
      query ($chatRoomId: ID!) {
        chatRoom(where: { id: $chatRoomId }) {
          id
          name
          participants {
            id
          }
        }
      }
    `;

    const { chatRoom } = await graphqlRequest(checkParticipantQuery, {
      chatRoomId
    });

    if (!chatRoom || !chatRoom.participants.some((p: { id: string }) => p.id === userId)) {
      return res.status(403).json({ error: "NOT_A_PARTICIPANT" });
    }

    // Update the chat room
    const mutation = `
      mutation ($id: ID!, $name: String!) {
        updateChatRoom(
          where: { id: $id }
          data: { name: $name }
        ) {
          id
          name
          participants {
            id
            name
            imageUrl
          }
        }
      }
    `;

    const result = await graphqlRequest(mutation, { id: chatRoomId, name });
    const updatedRoom = result.updateChatRoom;

    // Broadcast the update to all participants
    const io = req.app.get('io');
    updatedRoom.participants.forEach((participant: { id: string }) => {
      io.to(`user-${participant.id}`).emit('chat-room-updated', updatedRoom);
    });

    res.json(updatedRoom);
  } catch (error) {
    console.error("❌ Error renaming chat room:", error);
    res.status(500).json({ error: "SERVER_ERROR_RENAME_CHATROOM" });
  }
});

/**
 * DELETE /chatrooms/:id
 * Delete a chat room (only if the user is a participant).
 */
router.delete("/:id", async (req: AuthenticatedAppRequest, res) => {
  const chatRoomId = req.params.id;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: "UNAUTHORIZED" });

  try {
    // First get the chat room with participants
    const getRoomQuery = `
      query ($chatRoomId: ID!) {
        chatRoom(where: { id: $chatRoomId }) {
          id
          participants {
            id
          }
        }
      }
    `;

    const { chatRoom } = await graphqlRequest(getRoomQuery, { chatRoomId });

    if (!chatRoom || !chatRoom.participants.some((p: { id: string }) => p.id === userId)) {
      return res.status(403).json({ error: "NOT_A_PARTICIPANT" });
    }

    const participantIds = chatRoom.participants.map((p: { id: string }) => p.id);

    // Delete the chat room
    const mutation = `
      mutation ($id: ID!) {
        deleteChatRoom(where: { id: $id }) {
          id
        }
      }
    `;

    const result = await graphqlRequest(mutation, { id: chatRoomId });

    // Broadcast the deletion to all participants
    const io = req.app.get('io');
    participantIds.forEach((participantId: string) => {
      io.to(`user-${participantId}`).emit('chat-room-deleted', { id: chatRoomId });
    });

    res.json({ success: true, deletedId: result.deleteChatRoom.id });
  } catch (error) {
    console.error("❌ Error deleting chat room:", error);
    res.status(500).json({ error: "SERVER_ERROR_DELETE_CHATROOM" });
  }
});

export default router;