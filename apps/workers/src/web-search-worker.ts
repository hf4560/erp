import { Kafka } from 'kafkajs';

const brokers = (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(',');
const kafka = new Kafka({ clientId: 'web-search-worker', brokers });
const consumer = kafka.consumer({ groupId: 'web-search-consumers' });
const producer = kafka.producer();
const dedupe = new Set<string>();

async function run(): Promise<void> {
  await consumer.connect();
  await producer.connect();
  await consumer.subscribe({ topic: 'price.lookup.requested', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      const payload = message.value?.toString() ?? '{}';
      try {
        const job = JSON.parse(payload) as { mpn?: string; manufacturer?: string; currency?: string; region?: string };
        const dedupeKey = `${job.mpn ?? ''}:${job.manufacturer ?? ''}:${job.currency ?? ''}:${job.region ?? ''}`;
        if (dedupe.has(dedupeKey)) return;
        dedupe.add(dedupeKey);
        const result = {
          ...job,
          source: 'mock-price-feed',
          confidence: 0.86
        };
        await producer.send({ topic: 'price.lookup.completed', messages: [{ value: JSON.stringify(result) }] });
      } catch (error) {
        await producer.send({ topic: 'price.lookup.dlq', messages: [{ value: payload, headers: { reason: Buffer.from(String(error)) } }] });
      }
    }
  });
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Web-search worker failed', error);
  process.exit(1);
});
