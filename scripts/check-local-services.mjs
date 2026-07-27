import { readFile } from "node:fs/promises";

const compose = await readFile(new URL("../compose.yaml", import.meta.url), "utf8");

const requiredControls = [
  ["PostgreSQL binds only to loopback", '"127.0.0.1:5432:5432"'],
  ["Redis binds only to loopback", '"127.0.0.1:6379:6379"'],
  ["Redis requires authentication", '"--requirepass"'],
  ["Redis receives its local password from the environment", "REDIS_PASSWORD:"],
  ["Redis health checks authenticate", "REDISCLI_AUTH="],
];

const missing = requiredControls.filter(([, marker]) => !compose.includes(marker));

if (missing.length > 0) {
  for (const [description] of missing) {
    console.error(`Missing local-service security control: ${description}`);
  }
  process.exitCode = 1;
} else {
  process.stdout.write("Local PostgreSQL and Redis publication controls are present.\n");
}
