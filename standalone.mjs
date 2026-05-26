#!/usr/bin/env node
/**
 * Standalone A2A Gateway launcher
 * Extracts the HTTP server logic from the plugin and runs it directly
 */
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Load the plugin module
const pluginModule = await import("./dist/index.js");
const plugin = pluginModule.default;

// Minimal API mock
const mockLogger = {
  info: (...args) => console.log("[a2a]", new Date().toISOString(), ...args),
  warn: (...args) => console.warn("[a2a]", new Date().toISOString(), ...args),
  error: (...args) => console.error("[a2a]", new Date().toISOString(), ...args),
  debug: (...args) => {},
};

// Parse config with defaults
const config = pluginModule.parseConfig({
  enabled: true,
  server: {
    port: parseInt(process.env.A2A_PORT || "18800"),
    host: process.env.A2A_HOST || "0.0.0.0",
  },
  storage: {
    tasksDir: process.env.A2A_STORAGE_DIR || path.join(__dirname, "storage"),
  },
  observability: {
    structuredLogs: false,
    auditLogPath: null,
  },
  security: {
    inboundAuth: process.env.A2A_AUTH || "none",
    validTokens: process.env.A2A_TOKEN ? [process.env.A2A_TOKEN] : [],
  },
});

// Create the components that register() would create
const { A2AClient } = await import("./dist/index.js");
const { DefaultRequestHandler } = await import("@a2a-js/sdk/server");
const { AGENT_CARD_PATH } = await import("@a2a-js/sdk");

// Import the internal classes from the bundled code
// We need to manually set up the HTTP handler

// Simple approach: just call register() with a mock API that captures the service start
let capturedStart = null;

const mockApi = {
  logger: mockLogger,
  pluginConfig: {
    enabled: true,
    server: { port: 18800, host: "0.0.0.0" },
  },
  resolvePath: (p) => path.resolve(__dirname, p),
  registerService: (svc) => {
    mockLogger.info("registerService called:", svc.id);
    capturedStart = svc.start;
  },
  registerTool: () => {},
  registerGatewayMethod: () => {},
};

// Call register to set up the service
plugin.register(mockApi);

if (capturedStart) {
  mockLogger.info("Starting A2A Gateway service...");
  try {
    await capturedStart({});
    mockLogger.info("A2A Gateway started successfully");
  } catch (err) {
    mockLogger.error("Failed to start:", err.message);
    process.exit(1);
  }
} else {
  mockLogger.error("No service start function captured");
  process.exit(1);
}
