import { Queue, type JobsOptions } from "bullmq";
import IORedis from "ioredis";

import { jobEnvelopeSchema, type JobEnvelope } from "@bizo/contracts/jobs";

const defaultJobOptions: JobsOptions = {
  attempts: 5,
  backoff: { type: "exponential", delay: 1_000 },
  removeOnComplete: { age: 86_400, count: 10_000 },
  removeOnFail: { age: 604_800, count: 50_000 },
};

export function createRedisConnection(redisUrl: string): IORedis {
  return new IORedis(redisUrl, {
    enableReadyCheck: true,
    maxRetriesPerRequest: null,
  });
}

export function createQueue(name: string, connection: IORedis): Queue<JobEnvelope> {
  return new Queue<JobEnvelope>(name, {
    connection,
    defaultJobOptions,
  });
}

export async function enqueue(queue: Queue<JobEnvelope>, envelope: JobEnvelope): Promise<void> {
  const validated = jobEnvelopeSchema.parse(envelope);
  await queue.add(validated.name, validated, { jobId: validated.id });
}
