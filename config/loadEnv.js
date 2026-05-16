import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// override: true — shell/session AWS_* vars must not win over backend/.env
dotenv.config({
  path: path.join(__dirname, "..", ".env"),
  override: true,
});
