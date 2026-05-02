import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = join(process.cwd(), "build");
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml"
};

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const path = normalize(join(root, pathname));
  if (!path.startsWith(root) || !existsSync(path) || !(await stat(path)).isFile()) {
    response.writeHead(404);
    response.end("Not found");
    return;
  }
  response.writeHead(200, { "content-type": types[extname(path)] || "application/octet-stream" });
  createReadStream(path).pipe(response);
}).listen(port, "127.0.0.1", () => {
  process.stdout.write(`Serving build on http://127.0.0.1:${port}\n`);
});
