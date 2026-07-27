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
      resolve();
    });
    req.on('error', () => resolve());
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("Starting DDoS simulation script...");
  
  const batchSize = 7;
  
  for (let batch = 1; batch <= 3; batch++) {
    console.log(`Sending batch ${batch}/3...`);
    const promises = [];
    for (let i = 1; i <= 50; i++) {
      const ip = `192.168.1.${i}`;
      const isolateId = `iso-${Math.floor(i / 10)}`;
      for (let j = 0; j < batchSize; j++) {
        promises.push(sendRequest(ip, isolateId));
      }
    }
    await Promise.all(promises);
    console.log(`Batch ${batch} completed. Sleeping 6 seconds...`);
    await delay(6000);
  }

  console.log("Sending final trigger request...");
  await sendRequest("192.168.1.1", "iso-0");
  
  console.log("DDoS simulation finished.");
}

main();
