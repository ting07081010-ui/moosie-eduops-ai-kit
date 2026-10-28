import { existsSync } from "node:fs";
import path from "node:path";

const envFilePath = path.resolve(process.cwd(), ".env");

if (existsSync(envFilePath)) {
  if (typeof process.loadEnvFile !== "function") {
    throw new Error("Loading .env requires Node.js 20.12+ (Node 20) or 21.7+.");
  }
  process.loadEnvFile(envFilePath);
}
