const parser = require("cron-parser");
console.log("Keys:", Object.keys(parser));
console.log("Type of parseExpression:", typeof parser.parseExpression);
if (parser.default) {
  console.log("Type of default.parseExpression:", typeof parser.default.parseExpression);
}
