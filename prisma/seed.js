const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

async function main() {
  const email = normalizeEmail(process.env.SEED_ADMIN_EMAIL);
  const name = String(process.env.SEED_ADMIN_NAME || "Admin").trim() || "Admin";
  const password = String(process.env.SEED_ADMIN_PASSWORD || "");

  if (!email) {
    throw new Error("SEED_ADMIN_EMAIL is required");
  }
  if (!password) {
    throw new Error("SEED_ADMIN_PASSWORD is required");
  }

  const prisma = new PrismaClient();

  try {
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE"
      },
      create: {
        email,
        name,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE"
      }
    });

    console.log(`Seeded admin user: ${user.email} (${user.id})`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

