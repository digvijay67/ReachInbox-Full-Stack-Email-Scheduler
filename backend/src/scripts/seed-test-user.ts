import "dotenv/config";

import { prisma } from "../lib/prisma";

async function main() {
  const etherealUser =
    process.env.SMTP_USER;

  const etherealPassword =
    process.env.SMTP_PASS;

  if (!etherealUser || !etherealPassword) {
    throw new Error(
      "SMTP_USER and SMTP_PASS are required"
    );
  }

  const user = await prisma.user.upsert({
    where: {
      googleId: "test-google-user",
    },
    update: {},
    create: {
      googleId: "test-google-user",
      name: "Test User",
      email: "test@reachinbox.local",
    },
  });

  const sender =
    await prisma.sender.findFirst({
      where: {
        userId: user.id,
      },
    });

  if (!sender) {
    await prisma.sender.create({
      data: {
        userId: user.id,
        email: etherealUser,
        name: "ReachInbox Test",
        etherealUser,
        etherealPassword,
      },
    });
  }

  console.log("Test user ID:", user.id);
  console.log("Test user created successfully");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });