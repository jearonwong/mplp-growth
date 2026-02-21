import * as cronParser from "cron-parser";

try {
  let date = cronParser.parseExpression("0 9 * * 1").next();
  console.log("SUCCESS:", date.toString());
} catch (e) {
  console.log("FAIL:", e);
}
