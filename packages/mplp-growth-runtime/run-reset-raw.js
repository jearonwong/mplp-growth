const fs = require("fs");
const path = require("path");
const dataDir = process.env.MPLP_DATA_DIR || path.join(__dirname, "data");
const nodesDir = path.join(dataDir, "vsl", "nodes");

try {
  let count = 0;
  const files = fs.readdirSync(nodesDir);
  files.forEach((f) => {
    if (f.endsWith(".json")) {
      const dbPath = path.join(nodesDir, f);
      const data = JSON.parse(fs.readFileSync(dbPath));
      if (data.type === "domain:OutreachTarget") {
        data.status = "research";
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
        count++;
      }
    }
  });
  console.log("Reset count:", count);
} catch (e) {
  console.error("Could not reset", e.message);
}
