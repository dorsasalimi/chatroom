import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { authMiddleware } from "./middleware/authMiddleware";
import messagesRouter from "./routes/messages";
import createSendMessageRouter from "./routes/sendmessage";
import usersRouter from "./routes/users";
import chatroomRouter from "./routes/chatroom";
import getchatroomRouter from "./routes/getchatroom";
import participantsRouter from "./routes/participants";

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NEXT_PUBLIC_CMS_URL || "http://localhost:3001",
    credentials: true,
  },
});

const AUTH_SECRET = process.env.AUTH_SECRET || "this-is-a-secure-secret";

app.use(cors());
app.use(express.json());

// Routes
app.use("/messages", authMiddleware, messagesRouter);
app.use("/sendmessage", authMiddleware, createSendMessageRouter(io));
app.use("/users", usersRouter);
app.use("/chatroom", authMiddleware, chatroomRouter);
app.use("/getchatroom", authMiddleware, getchatroomRouter);
app.use("/chatroom-participants", participantsRouter);

// Store the io instance in the app for use in routes
app.set("io", io);

// Socket.IO setup
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("No token provided"));

  try {
    const user = jwt.verify(token, AUTH_SECRET);
    socket.data.user = user;
    next();
  } catch (err) {
    return next(new Error("Invalid token"));
  }
});

io.on("connection", (socket: Socket) => {
  const user = socket.data.user as { id: string; email: string };

  // Join user-specific room
  if (user?.id) {
    socket.join(`user-${user.id}`);
  }

  socket.on("join-room", (chatRoomId: string) => {
    socket.join(chatRoomId);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", user?.email);
  });
});

const PORT = process.env.PORT || 3004;
server.listen(PORT, () => {
  console.log(`🚀 Chat server running on port ${PORT}`);
});