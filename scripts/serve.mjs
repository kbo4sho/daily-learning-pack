import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
export function serve(root = resolve("dist"), port = 4173, host = "127.0.0.1") {
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json",
    ".woff2": "font/woff2",
    ".pdf": "application/pdf",
    ".png": "image/png",
  };
  const server = createServer(async (req, res) => {
    try {
      // Test the exact GitHub Pages project prefix locally as well as the root.
      let pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (pathname.startsWith("/daily-learning-pack/"))
        pathname = pathname.slice("/daily-learning-pack".length);
      let path = resolve(root, `.${pathname}`);
      if (path !== root && !path.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      if ((await stat(path)).isDirectory()) path = resolve(path, "index.html");
      res.writeHead(200, {
        "Content-Type": types[extname(path)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(await readFile(path));
    } catch {
      res.writeHead(404).end("Not found");
    }
  });
  return new Promise((resolveServer) =>
    server.listen(port, host, () => resolveServer(server)),
  );
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const host = process.env.HOST || "127.0.0.1";
  await serve(resolve("dist"), Number(process.env.PORT || 4173), host);
  console.log(
    `Preview: http://${host}:${process.env.PORT || 4173}/daily-learning-pack/`,
  );
}
