import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
process.env.CLI_MODE = "true";
const { findAllNoCache } = require("../lib/sheets_db");

(async () => {
  const sp = await findAllNoCache("Semi_Products");
  for (const s of sp) {
    console.log(s.id, s.name, "| batch_yield:", s.batch_yield, "| base_unit:", s.base_unit);
  }
})();
