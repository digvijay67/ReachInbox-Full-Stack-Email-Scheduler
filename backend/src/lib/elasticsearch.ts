import { Client } from "@elastic/elasticsearch";

export const EMAIL_INDEX =
  process.env.ELASTIC_EMAIL_INDEX ||
  "emails";

export const esClient =
  new Client({
    node:
      process.env.ELASTICSEARCH_URL ||
      "http://localhost:9200",
  });

export async function ensureEmailIndex() {
  try {
    const exists =
      await esClient.indices.exists({
        index: EMAIL_INDEX,
      });

    if (exists) {
      return;
    }

    await esClient.indices.create({
      index: EMAIL_INDEX,

      mappings: {
        properties: {
          id: {
            type: "integer",
          },

          userId: {
            type: "integer",
          },

          senderId: {
            type: "integer",
          },

          to: {
            type: "text",
          },

          subject: {
            type: "text",
          },

          body: {
            type: "text",
          },

          status: {
            type: "keyword",
          },

          scheduledAt: {
            type: "date",
          },

          sentAt: {
            type: "date",
          },

          createdAt: {
            type: "date",
          },

          updatedAt: {
            type: "date",
          },
        },
      },
    });

    console.log(
      `Elasticsearch index "${EMAIL_INDEX}" created`
    );
  } catch (error) {
    console.error(
      "Failed to ensure Elasticsearch index:",
      error instanceof Error
        ? error.message
        : error
    );
  }
}