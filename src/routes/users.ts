import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { graphqlRequest } from "../lib/graphqlClient";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const user = jwt.verify(token, process.env.AUTH_SECRET || "secret") as { id: string };

    const query = `
      query {
        users {
          id
          name
          email
        }
      }
    `;

    const data = await graphqlRequest<{ users: { id: string; name: string; email: string }[] }>(query, {}, token);

    if (!data || !Array.isArray(data.users)) {
      return res.status(500).json({ error: "Invalid data structure from GraphQL" });
    }

    // filter out current user
    const filteredUsers = data.users.filter(u => u.id !== user.id);

    res.json({ users: filteredUsers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

export default router;
