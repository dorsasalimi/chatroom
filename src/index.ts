import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import fetch, { RequestInit, Response } from "node-fetch";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3001", // Your CMS frontend
    credentials: true,
  },
});

const GRAPHQL_ENDPOINT = "http://localhost:3000/api/graphql";
const AUTH_SECRET = process.env.AUTH_SECRET || "this-is-a-secure-secret";

app.use(cors());
app.use(express.json());

type GraphQLVariables = Record<string, any>;

async function graphqlRequest<T>(
  query: string,
  variables: GraphQLVariables = {},
  token?: string
): Promise<T> {
  const res = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({ query, variables }),
  });

  const json = await res.json();
  if (json.errors) {
    console.error("GraphQL Errors:", json.errors);
    throw new Error("GraphQL error");
  }

  return json.data;
}

interface JwtUserPayload {
  id: string;
  email: string;
  name?: string;
}

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  console.log("🛡️ Received socket token:", token);

  if (!token) return next(new Error("No token provided"));

  try {
    const user = jwt.verify(token, AUTH_SECRET);
    console.log("✅ Token verified:", user);
    socket.data.user = user;
    next();
  } catch (err) {
    console.error("❌ JWT verification failed:", err);
    return next(new Error("Invalid token"));
  }
});

io.on("connection", (socket: Socket) => {
  const user = socket.data.user as JwtUserPayload;
  console.log("🔌 User connected:", user?.email);

  socket.on("join-room", (chatRoomId: string) => {
    socket.join(chatRoomId);
    console.log(`✅ ${user.email} joined room ${chatRoomId}`);
  });

  socket.on(
    "send-message",
    async ({
      chatRoomId,
      content,
    }: {
      chatRoomId: string;
      content: string;
    }) => {
      try {
        const mutation = `
          mutation CreateMessage($content: String!, $chatRoomId: ID!, $senderId: ID!) {
            createMessage(data: {
              content: $content,
              chatRoom: { connect: { id: $chatRoomId } },
              sender: { connect: { id: $senderId } }
            }) {
              id
              content
              createdAt
              sender {
                id
                name
              }
            }
          }
        `;

        const data = await graphqlRequest<{
          createMessage: {
            id: string;
            content: string;
            createdAt: string;
            sender: { id: string; name: string };
          };
        }>(
          mutation,
          {
            content,
            chatRoomId,
            senderId: user.id,
          },
          socket.handshake.auth.token
        );

        const savedMessage = data.createMessage;
        console.log(data);
        io.to(chatRoomId).emit("new-message", savedMessage);
        console.log("📤 Emitting message to room:", chatRoomId, savedMessage);
      } catch (err) {
        console.error("❌ Error sending message:", (err as Error).message);
      }
    }
  );
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", user?.email);
  });
});

server.listen(3004, () => {
  console.log("🚀 Chat server running on http://localhost:3004");
});
