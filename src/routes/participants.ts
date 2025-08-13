import express, { Request } from 'express';
import { graphqlRequest } from '../lib/graphqlClient';

interface AuthRequest extends Request {
  user?: {
    id: string;
    name?: string;
    email?: string;
    role?: {
      id: string;
      name: string;
    };
  };
}

const router = express.Router();

/**
 * POST /chatrooms/:id/participants
 * Add participants to a chat room
 */
router.post('/:id/participants', async (req: AuthRequest, res) => {
  const chatRoomId = req.params.id;
  const { participantIds } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!participantIds || !Array.isArray(participantIds)) {
    return res.status(400).json({ error: 'participantIds must be an array' });
  }

  try {
    // Include the requester just in case (optional)
    const allIds = Array.from(new Set([...participantIds, userId]));

    const mutation = `
      mutation UpdateChatRoom($id: ID!, $participants: [UserWhereUniqueInput!]!) {
        updateChatRoom(
          where: { id: $id },
          data: {
            participants: { connect: $participants }
          }
        ) {
          id
          name
          participants { id name }
        }
      }
    `;

    const variables = { id: chatRoomId, participants: allIds.map(id => ({ id })) };

    const response = await graphqlRequest(mutation, variables);
    res.json(response.updateChatRoom);
  } catch (err) {
    console.error('❌ Error adding participants:', err);
    res.status(500).json({ error: 'SERVER_ERROR_ADDING_PARTICIPANTS' });
  }
});

/**
 * DELETE /chatrooms/:id/participants
 * Remove participants from a chat room
 */
router.delete('/:id/participants', async (req: AuthRequest, res) => {
  const chatRoomId = req.params.id;
  const { participantIds } = req.body;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!participantIds || !Array.isArray(participantIds)) {
    return res.status(400).json({ error: 'participantIds must be an array' });
  }

  try {
    const mutation = `
      mutation UpdateChatRoom($id: ID!, $participants: [UserWhereUniqueInput!]!) {
        updateChatRoom(
          where: { id: $id },
          data: {
            participants: { disconnect: $participants }
          }
        ) {
          id
          name
          participants { id name }
        }
      }
    `;

    const variables = { id: chatRoomId, participants: participantIds.map(id => ({ id })) };

    const response = await graphqlRequest(mutation, variables);
    res.json(response.updateChatRoom);
  } catch (err) {
    console.error('❌ Error removing participants:', err);
    res.status(500).json({ error: 'SERVER_ERROR_REMOVING_PARTICIPANTS' });
  }
});

export default router;
