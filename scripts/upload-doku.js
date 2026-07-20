const fs = require('fs');
const path = require('path');
const readline = require('readline');

const WIKI_BASE_URL = 'https://doku.wikichree.com/modparks';

const fileToPageMap = {
  'Modparks.txt': 'start',
  'ModparksAPI.txt': 'api',
  'ModparksCLI.txt': 'cli',
  'Auth.txt': 'auth',
  'Collections.txt': 'collections',
  'Comments.txt': 'comments',
  'Ideas.txt': 'ideas',
  'Projects.txt': 'projects',
  'Versions.txt': 'versions',
  'Webhooks.txt': 'webhooks',
  'setup.txt': 'setup',
  'database.txt': 'database',
  'recipe.txt': 'recipe'
};

async function run(sessionCookie) {
  if (!sessionCookie) {
    console.error('Cookie is required.');
    process.exit(1);
  }
  
  const cookieHeader = `DokuWiki=${sessionCookie.trim()}`;
  const docsDir = path.join(__dirname, '..', 'docs-md', 'doku');
  
  for (const [fileName, pageId] of Object.entries(fileToPageMap)) {
    const filePath = path.join(docsDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`File not found: ${filePath}, skipping...`);
      continue;
    }
    
    console.log(`Processing ${fileName} -> page: ${pageId}...`);
    const content = fs.readFileSync(filePath, 'utf8');
    
    try {
      // 1. Get edit form to extract token
      const editUrl = `${WIKI_BASE_URL}/doku.php?id=${encodeURIComponent(pageId)}&do=edit`;
      const getRes = await fetch(editUrl, {
        headers: {
          'Cookie': cookieHeader
        }
      });
      
      if (!getRes.ok) {
        throw new Error(`Failed to fetch edit page: ${getRes.status} ${getRes.statusText}`);
      }
      
      const html = await getRes.text();
      
      // Check if logged in. If not logged in, we won't see wikitext textarea.
      if (!html.includes('name="wikitext"')) {
        throw new Error('Could not find edit textarea. You might not be logged in or lack edit permission.');
      }
      
      const sectokMatch = html.match(/name="sectok"\s+value="([^"]+)"/);
      const changecheckMatch = html.match(/name="changecheck"\s+value="([^"]+)"/);
      const dateMatch = html.match(/name="date"\s+value="([^"]+)"/);
      
      if (!sectokMatch) {
        throw new Error('Could not extract sectok from page.');
      }
      
      const sectok = sectokMatch[1];
      const changecheck = changecheckMatch ? changecheckMatch[1] : '';
      const date = dateMatch ? dateMatch[1] : '0';
      
      console.log(`  Extracted sectok: ${sectok}, changecheck: ${changecheck}, date: ${date}`);
      
      // 2. POST save request
      const postParams = new URLSearchParams();
      postParams.append('sectok', sectok);
      postParams.append('id', pageId);
      postParams.append('rev', '0');
      postParams.append('date', date);
      postParams.append('prefix', '');
      postParams.append('suffix', '');
      postParams.append('changecheck', changecheck);
      postParams.append('wikitext', content);
      postParams.append('summary', 'Upload by Antigravity script');
      postParams.append('do[save]', '1');
      
      const postRes = await fetch(`${WIKI_BASE_URL}/doku.php?id=${encodeURIComponent(pageId)}&do=edit`, {
        method: 'POST',
        headers: {
          'Cookie': cookieHeader,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: postParams.toString()
      });
      
      if (!postRes.ok) {
        throw new Error(`Failed to save page: ${postRes.status} ${postRes.statusText}`);
      }
      
      const postHtml = await postRes.text();
      if (postHtml.includes('name="wikitext"')) {
        console.error(`  Warning: The edit textarea was still found in the response. Saving might have failed.`);
      } else {
        console.log(`  Successfully uploaded ${pageId}!`);
      }
      
    } catch (err) {
      console.error(`  Error uploading ${pageId}:`, err.message);
    }
  }
  
  console.log('Finished uploading all documents.');
}

const args = process.argv.slice(2);
if (args[0]) {
  run(args[0]);
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Please enter your DokuWiki session cookie value (the value of the "DokuWiki" cookie): ', async (sessionCookie) => {
    rl.close();
    run(sessionCookie);
  });
}
