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

router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, participantIds } = req.body;
    const creatorId = req.user?.id;

    if (!creatorId) {
      return res.status(401).json({ error: 'Unauthorized: missing user ID' });
    }

    if (!participantIds || !Array.isArray(participantIds)) {
      return res.status(400).json({ error: 'participantIds must be an array' });
    }

    // Include creator in the participants list
    const allParticipantIds = Array.from(new Set([...participantIds, creatorId]));

    const mutation = `
      mutation CreateChatRoom($name: String!, $participants: [UserWhereUniqueInput!]!) {
        createChatRoom(data: {
          name: $name,
          participants: {
            connect: $participants
          }
        }) {
          id
          name
          participants {
            id
            name
          }
        }
      }
    `;

    const variables = {
      name,
      participants: allParticipantIds.map((id: string) => ({ id })),
    };

    console.log('🚀 Sending mutation with variables:', variables);

    const response = await graphqlRequest(mutation, variables);

    return res.json(response.createChatRoom);
  } catch (error: any) {
    console.error('❌ Error creating chat room:', error?.response?.errors || error?.message || error);
    return res.status(500).json({
      error: 'Failed to create chat room',
      details: error?.response?.errors || error?.message || error,
    });
  }
});

export default router;
