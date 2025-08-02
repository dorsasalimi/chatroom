import express from 'express';
import { graphqlRequest } from '../lib/graphqlClient';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { name, participantIds } = req.body;

    if (!participantIds || participantIds.length < 2) {
      return res.status(400).json({ error: 'At least two participants required' });
    }

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
      participants: participantIds.map((id: string) => ({ id })),
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
