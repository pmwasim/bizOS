import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const privateServices = new Set(["mailpit", "postgres", "redis"]);
const optionalPrivateServices = new Set(["n8n"]);
const loopbackAddresses = new Set(["127.0.0.1", "::1"]);

function assertLoopbackService(errors, serviceName, service, { required }) {
  if (!service) {
    if (required) {
      errors.push(`required private service "${serviceName}" is missing`);
    }
    return;
  }

  if (service.network_mode === "host") {
    errors.push(`${serviceName} must not use host networking`);
  }

  for (const port of service.ports ?? []) {
    if (!loopbackAddresses.has(port.host_ip)) {
      errors.push(
        `${serviceName} port ${String(port.published ?? port.target)} must bind to loopback`,
      );
    }
  }
}

export function validateLocalServices(compose) {
  const errors = [];
  const services = compose.services ?? {};

  for (const serviceName of privateServices) {
    assertLoopbackService(errors, serviceName, services[serviceName], { required: true });
  }

  for (const serviceName of optionalPrivateServices) {
    assertLoopbackService(errors, serviceName, services[serviceName], { required: false });
  }

  const redis = services.redis;
  const redisCommand = Array.isArray(redis?.command) ? redis.command : [];
  if (!redisCommand.includes("--requirepass")) {
    errors.push("Redis must require authentication");
  }
  if (!redis?.environment?.REDIS_PASSWORD) {
    errors.push("Redis must receive its password from the environment");
  }

  const redisHealthcheck = Array.isArray(redis?.healthcheck?.test)
    ? redis.healthcheck.test.join(" ")
    : "";
  if (!redisHealthcheck.includes("REDISCLI_AUTH=")) {
    errors.push("Redis health checks must authenticate");
  }

  if (services.postgres?.environment?.POSTGRES_HOST_AUTH_METHOD === "trust") {
    errors.push("PostgreSQL must not use trust authentication");
  }

  return errors;
}

export function readNormalizedCompose() {
  const result = spawnSync(
    "docker",
    ["compose", "--profile", "ops", "config", "--format", "json"],
    {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
      env: {
        ...process.env,
        REDIS_PASSWORD: "local-service-policy-verification-only",
      },
    },
  );

  if (result.error) {
    throw new Error(`Docker Compose is required to validate local service policy: ${result.error}`);
  }
  if (result.status !== 0) {
    throw new Error(`Docker Compose validation failed: ${result.stderr.trim()}`);
  }

  return JSON.parse(result.stdout);
}

function main() {
  const errors = validateLocalServices(readNormalizedCompose());
  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`Local-service security policy violation: ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    "Private local services use authenticated, loopback-only publication controls.\n",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
