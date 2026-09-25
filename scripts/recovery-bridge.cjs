// Temporary loopback bridge for recovery emails already sent to localhost:3000.
// Fragments are forwarded by the browser, never sent to or logged by this server.
import("node:http").then(({ default: http }) => {
for (const host of ["127.0.0.1", "::1"]) http.createServer((request, response) => {
  if (!/^localhost:3000$|^127\.0\.0\.1:3000$|^\[::1\]:3000$/.test(request.headers.host || "")) {
    response.writeHead(403); response.end(); return;
  }
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  response.end('<!doctype html><html lang="es"><meta charset="utf-8"><title>CTRugby · Recuperación</title><p>Abriendo recuperación…</p><script>location.replace("http://localhost:3001/recuperar"+location.hash)</script></html>');
}).listen(3000, host, () => console.log("Recuperación disponible en " + host + ":3000"));

});


