const app = require("./app");
const env = require("./config/env");
const { connectDatabase } = require("./config/database");
const { setupWebSocketServer } = require("./services/websocket.service");

async function bootstrap() {
  try {
    await connectDatabase();
    const server = app.listen(env.port, () => {
      console.log(`Server is running on port ${env.port}`);
    });
    setupWebSocketServer(server);
    console.log("WebSocket server initialized");
  } catch (error) {
    console.error("Failed to start server:", error.message);
    process.exit(1);
  }
}

bootstrap();
