import express from "express";
import { graphqlRequest } from "../lib/graphqlClient";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const query = `
      query {
        chatRooms {
          id
          name
          participants {
            id
            name
          }
          messages(orderBy: { createdAt: desc }, take: 1) {
            content
            createdAt
          }
        }
      }
    `;

    const data = await graphqlRequest(query);

    res.json({ chatRooms: data.chatRooms });
  } catch (error) {
    console.error("Error fetching chat rooms:", error);
    res.status(500).json({ error: "Failed to fetch chat rooms" });
  }
});

export default router;
