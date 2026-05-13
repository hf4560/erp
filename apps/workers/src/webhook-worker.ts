import { Kafka } from 'kafkajs';

const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
const kafka = new Kafka({ clientId: 'gitlab-webhook-worker', brokers });
const consumer = kafka.consumer({ groupId: 'gitlab-webhook-consumers' });
const producer = kafka.producer();
const seenEventKeys = new Set<string>();

async function run(): Promise<void> {
  await consumer.connect();
  await producer.connect();
  await consumer.subscribe({ topic: 'gitlab.webhook.received', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const payload = message.value?.toString() ?? '{}';
      try {
        const event = JSON.parse(payload) as { eventKey?: string };
        const eventKey = event.eventKey ?? `raw:${payload.slice(0, 100)}`;
        if (seenEventKeys.has(eventKey)) return;
        seenEventKeys.add(eventKey);
        await producer.send({ topic: 'gitlab.webhook.processed', messages: [{ value: payload }] });
      } catch (error) {
        const retryCount = Number(message.headers?.retryCount?.toString() ?? '0') + 1;
        const nextRetryAt = new Date(Date.now() + Math.min(60_000 * retryCount, 10 * 60_000)).toISOString();
        await producer.send({
          topic: 'gitlab.webhook.dlq',
          messages: [{
            value: payload,
            headers: {
              reason: Buffer.from(String(error)),
              retryCount: Buffer.from(String(retryCount)),
              nextRetryAt: Buffer.from(nextRetryAt)
            }
          }]
        });
      }
    }
  });
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Webhook worker failed', error);
  process.exit(1);
});
