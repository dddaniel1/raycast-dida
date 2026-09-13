const fs = require("fs");
const t = fs.readFileSync("node_modules/@raycast/api/dist/commands/develop/index.js", "utf8");
const kws = ["open.{0,40}scheme", "scheme.{0,40}open", "scheme.{0,60}bundle", "function C2e\b", "async function C2e", "C2e=async"];
for (const kw of kws) {
  const re = new RegExp(kw, "gi");
  const hits = [];
  let m;
  while ((m = re.exec(t)) && hits.length < 4) {
    hits.push(t.slice(Math.max(0, m.index - 90), m.index + 110).replace(/\s+/g, " "));
  }
  if (hits.length) {
    console.log("=== " + kw);
    console.log(hits.join("\n"));
  }
}
