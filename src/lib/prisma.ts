import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasourceUrl: process.env.DATABASE_URL,
});

// Eagerly connect with retry to handle Neon cold starts
(async () => {
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await prisma.$connect();
      console.log('✅ Database connected');
      return;
    } catch (err) {
      console.error(`⚠️ DB connection attempt ${attempt}/5 failed:`, (err as Error).message);
      if (attempt < 5) await new Promise(r => setTimeout(r, 5000));
    }
  }
  console.error('❌ Could not connect to database after 5 attempts');
})();

export default prisma;
