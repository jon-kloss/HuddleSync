import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import config, { validateConfig } from "./config/index.js";
import { globalErrorHandler } from "./middleware/errorHandler.js";
import { setupWebSocket } from "./websocket/handler.js";
import authRoutes from "./routes/auth.js";
import sessionRoutes from "./routes/sessions.js";
import teamRoutes from "./routes/teams.js";
import userRoutes from "./routes/users.js";

// Validate environment configuration
validateConfig();

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: config.corsOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
  pingInterval: 15000,
  pingTimeout: 10000,
});

// Middleware
app.use(helmet());
app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(morgan(config.isDevelopment ? "dev" : "combined"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/sessions", sessionRoutes);
app.use("/api/v1/teams", teamRoutes);
app.use("/api/v1/users", userRoutes);

// WebSocket setup
setupWebSocket(io);

// Global error handler (must be last)
app.use(globalErrorHandler);

// Start server
httpServer.listen(config.port, () => {
  console.log(`HuddleSync backend running on port ${config.port}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`WebSocket: ws://localhost:${config.port}/huddle`);
});

export { app, httpServer, io };
