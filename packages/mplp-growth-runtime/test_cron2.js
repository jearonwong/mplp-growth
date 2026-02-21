const parser = require("cron-parser");
console.log("Functions on parser:");
for (let key of Object.keys(parser)) {
  if (typeof parser[key] === "function") {
    console.log(key);
  }
}
console.log("Functions on parser.CronExpressionParser:");
for (let key of Object.keys(parser.CronExpressionParser || {})) {
  if (typeof parser.CronExpressionParser[key] === "function") {
    console.log("static:", key);
  }
}
