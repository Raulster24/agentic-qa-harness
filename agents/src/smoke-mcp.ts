// Diagnostic: proves the Playwright MCP + browser path works against the SUT
// without spending LLM tokens. Run with: npm run smoke
import { config } from "./config.js";
import { startPlaywrightMcp } from "./mcp.js";

const mcp = await startPlaywrightMcp();
console.log(`MCP tools available: ${mcp.tools.length}`);
console.log(mcp.tools.map((tool) => tool.name).join(", "));

const nav = await mcp.callTool("browser_navigate", { url: config.sutBaseUrl });
console.log("\n--- snapshot right after navigate (often empty on SPA first paint) ---");
console.log(nav.slice(0, 400));

await mcp.callTool("browser_wait_for", { time: 3 });
const snapshot = await mcp.callTool("browser_snapshot", {});
console.log("\n--- snapshot after 3s wait ---");
console.log(snapshot.slice(0, 1200));

await mcp.close();
process.exit(0);
