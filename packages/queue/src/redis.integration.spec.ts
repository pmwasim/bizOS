import { randomUUID } from "node:crypto";

import { afterEach, expect, test } from "vitest";

import { createQueue, createRedisConnection, enqueue } from "./index.js";

const redisTest = process.env.RUN_REDIS_TESTS === "true" ? test : test.skip;
const cleanups: Array<() => Promise<unknown>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) {
    await cleanup();
  }
});

redisTest("connects with the configured credentials and persists a job envelope", async () => {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) throw new Error("REDIS_URL is required when RUN_REDIS_TESTS=true");

  const connection = createRedisConnection(redisUrl);
  const queue = createQueue(`bizo-ci-${randomUUID()}`, connection);
  cleanups.push(
    () => queue.close(),
    () => connection.quit(),
  );

  const envelope = {
    correlationId: randomUUID(),
    id: randomUUID(),
    name: "document.pdf.generate",
    tenantId: randomUUID(),
    occurredAt: new Date().toISOString(),
    payload: { businessId: randomUUID(), quotationId: randomUUID() },
    schemaVersion: 1,
  };

  await enqueue(queue, envelope);
  const persisted = await queue.getJob(envelope.id);

  expect(persisted?.data).toEqual(envelope);
});
