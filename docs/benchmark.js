(async () => {
  // Reference to portal.html in the same directory as this script
  const portalFile = new URL("portal.html", import.meta.url);

  // Start Bun server on port 3000
  const server = Bun.serve({
    port: 3000,
    fetch(request) {
      const url = new URL(request.url);
      if (url.pathname === "/portal.html") {
        // Serve the portal.html file
        return Bun.file(portalFile.pathname);
      }
      return new Response("Not Found", { status: 404 });
    },
  });

  const samples = 50;
  let totalLoadTime = 0;
  const targetUrl = "http://localhost:3000/portal.html";

  // Run 50 sequential fetch requests
  for (let i = 0; i < samples; i++) {
    const start = performance.now();
    const response = await fetch(targetUrl);
    await response.text(); // Consume full response body to measure complete load time
    const end = performance.now();
    totalLoadTime += end - start;
  }

  // Calculate average response time
  const avgLoadTime = totalLoadTime / samples;

  // Output only the JSON result
  console.log(
    JSON.stringify({
      load_time_ms: Number(avgLoadTime.toFixed(1)),
      samples: samples,
    })
  );

  // Stop the server after test completes
  server.stop();
})();
