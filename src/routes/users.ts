import { Router, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { graphqlRequest } from "../lib/graphqlClient";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const user = jwt.verify(token, process.env.AUTH_SECRET || "this-is-a-secure-secret") as { id: string };

    const search = (req.query.search as string | undefined)?.trim().toLowerCase();

    const query = `
      query {
        users {
          id
          name
          email
          role {
            id
            name
          }
        }
      }
    `;

    const data = await graphqlRequest<{
      users: { id: string; name: string; email: string; role?: { id: string; name: string } }[];
    }>(query, {}, token);

    if (!data || !Array.isArray(data.users)) {
      return res.status(500).json({ error: "Invalid data structure from GraphQL" });
    }

    const filteredUsers = data.users
      .filter((u) => u.id !== user.id && u.role?.name.toLowerCase() !== "client")
      .filter((u) => {
        if (!search) return true;
        return (
          u.name.toLowerCase().includes(search) ||
          u.email.toLowerCase().includes(search)
        );
      });

    res.json({ users: filteredUsers });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

export default router;
