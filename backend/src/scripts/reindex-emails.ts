import "dotenv/config";

import { prisma } from "../lib/prisma";
import { ensureEmailIndex } from "../lib/elasticsearch";
import { indexEmail } from "../services/email-search.service";

const BATCH_SIZE = 500;

async function reindexAll(): Promise<void> {
  await ensureEmailIndex();

  let cursor: number | undefined;
  let totalIndexed = 0;

  while (true) {
    const emails = await prisma.email.findMany({
      take: BATCH_SIZE,

      orderBy: {
        id: "asc",
      },

      ...(cursor !== undefined
        ? {
            skip: 1,
            cursor: {
              id: cursor,
            },
          }
        : {}),
    });

    if (emails.length === 0) {
      break;
    }

    for (const email of emails) {
      await indexEmail(email);
      totalIndexed++;
    }

    cursor = emails[emails.length - 1].id;

    console.log(
      `Indexed ${totalIndexed} emails so far...`
    );
  }

  console.log(
    `Done. Reindexed ${totalIndexed} emails into Elasticsearch.`
  );
}

reindexAll()
  .catch((error) => {
    console.error("Reindex failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });