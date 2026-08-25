import assert from "node:assert/strict";
import test from "node:test";

import { validateLocalServices } from "./check-local-services.mjs";

function secureCompose() {
  return {
    services: {
      mailpit: {
        ports: [
          { host_ip: "127.0.0.1", published: "1025", target: 1025 },
          { host_ip: "127.0.0.1", published: "8025", target: 8025 },
        ],
      },
      postgres: {
        environment: { POSTGRES_HOST_AUTH_METHOD: "scram-sha-256" },
        ports: [{ host_ip: "127.0.0.1", published: "5432", target: 5432 }],
      },
      redis: {
        command: ["redis-server", "--requirepass", "$$REDIS_PASSWORD"],
        environment: { REDIS_PASSWORD: "test-only" },
        healthcheck: { test: ["CMD-SHELL", "REDISCLI_AUTH=x redis-cli ping"] },
        ports: [{ host_ip: "127.0.0.1", published: "6379", target: 6379 }],
      },
    },
  };
}

test("accepts authenticated private services bound to loopback", () => {
  assert.deepEqual(validateLocalServices(secureCompose()), []);
});

test("rejects wildcard publication for every private service", () => {
  for (const serviceName of ["mailpit", "postgres", "redis"]) {
    const compose = secureCompose();
    compose.services[serviceName].ports[0].host_ip = "0.0.0.0";

    assert.match(validateLocalServices(compose).join("\n"), /must bind to loopback/);
  }
});

test("rejects wildcard publication for optional n8n when present", () => {
  const compose = secureCompose();
  compose.services.n8n = {
    ports: [{ host_ip: "0.0.0.0", published: "5678", target: 5678 }],
  };

  assert.match(validateLocalServices(compose).join("\n"), /n8n .* must bind to loopback/);
});

test("rejects unauthenticated Redis and trusted PostgreSQL", () => {
  const compose = secureCompose();
  compose.services.redis.command = ["redis-server"];
  compose.services.redis.healthcheck.test = ["CMD", "redis-cli", "ping"];
  compose.services.postgres.environment.POSTGRES_HOST_AUTH_METHOD = "trust";

  assert.deepEqual(validateLocalServices(compose), [
    "Redis must require authentication",
    "Redis health checks must authenticate",
    "PostgreSQL must not use trust authentication",
  ]);
});
