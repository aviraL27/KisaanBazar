import { app } from "./app.js";
import { seedDemoData } from "./bootstrap/seedData.js";
import { connectMongo } from "./config/mongodb.js";
import { connectRedis } from "./config/redis.js";
import { env } from "./config/env.js";

async function start(): Promise<void> {
  await Promise.allSettled([connectMongo(), connectRedis()]);
  await seedDemoData();

  app.listen(env.PORT, () => {
    console.log(
      JSON.stringify({ ts: new Date().toISOString(), level: "info", msg: `API listening on ${env.PORT}` })
    );
  });
}

start().catch((error: unknown) => {
  console.error(JSON.stringify({ ts: new Date().toISOString(), level: "error", msg: "Failed to start API", error }));
  process.exit(1);
});
