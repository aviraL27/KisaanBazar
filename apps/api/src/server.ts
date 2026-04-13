import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.PORT, () => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level: "info", msg: `API listening on ${env.PORT}` }));
});
