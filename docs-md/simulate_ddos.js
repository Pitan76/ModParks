const http = require('http');

function sendRequest(ip, isolateId) {
  return new Promise((resolve) => {
    const req = http.get({
      hostname: 'localhost',
      port: 8787,
      path: '/api/download?slug=gun-and-weapons',
      headers: {
        'cf-connecting-ip': ip,
        'x-test-isolate-id': isolateId
      }
    }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("Starting chunked DDoS simulation script...");
  
  const allRequests = [];
  // Generate 1500 requests (50 IPs x 30 requests each)
  for (let i = 1; i <= 50; i++) {
    const ip = `192.168.1.${i}`;
    const isolateId = `iso-${Math.floor(i / 10)}`;
    for (let j = 0; j < 30; j++) {
      allRequests.push({ ip, isolateId });
    }
  }

  console.log(`Total requests queued: ${allRequests.length}`);
  
  // Send in chunks of 100
  const chunkSize = 100;
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < allRequests.length; i += chunkSize) {
    const chunk = allRequests.slice(i, i + chunkSize);
    const chunkPromises = chunk.map(r => sendRequest(r.ip, r.isolateId).then(ok => {
      if (ok) successCount++;
      else failCount++;
    }));
    await Promise.all(chunkPromises);
    await delay(50); // 50ms pause between chunks
  }
  
  console.log(`Burst sent. Success: ${successCount}, Failed: ${failCount}`);
  console.log("Sleeping 6 seconds for lock to clear...");
  await delay(6000);

  console.log("Sending final trigger request...");
  await sendRequest("192.168.1.1", "iso-0");
  
  console.log("DDoS simulation finished.");
}

main();
