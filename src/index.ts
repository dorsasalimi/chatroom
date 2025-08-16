import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import fetch, { RequestInit, Response } from "node-fetch";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { authMiddleware } from "./middleware/authMiddleware";
import messagesRouter from "./routes/messages";
import createSendMessageRouter from "./routes/sendmessage";
import usersRouter from "./routes/users";
import chatroomRouter from "./routes/chatroom";
import getchatroomRouter from "./routes/getchatroom";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001",
    credentials: true,
  },
});

const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_URL || "http://localhost:3000/api/graphql";
const AUTH_SECRET = process.env.AUTH_SECRET || "this-is-a-secure-secret";

app.use(cors());
app.use(express.json());
app.use('/messages', authMiddleware, messagesRouter);
app.use("/sendmessage", authMiddleware, createSendMessageRouter(io));
app.use('/users', usersRouter);
app.use('/chatroom', authMiddleware, chatroomRouter);
app.use('/getchatroom', authMiddleware, getchatroomRouter);

// Store the io instance in the app for use in routes
app.set('io', io);

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

  // Join room for user-specific updates
  if (user?.id) {
    socket.join(`user-${user.id}`);
    console.log(`✅ ${user.email} joined user room`);
  }

  socket.on("join-room", (chatRoomId: string) => {
    socket.join(chatRoomId);
    console.log(`✅ ${user.email} joined chat room ${chatRoomId}`);
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", user?.email);
  });
});

server.listen(3004, () => {
  console.log("🚀 Chat server running on http://localhost:3004");
});