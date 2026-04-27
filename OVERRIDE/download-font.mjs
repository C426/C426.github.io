import fs from 'fs';
import unzipper from 'unzipper';

const url = 'https://github.com/TakWolf/fusion-pixel-font/releases/download/2026.02.27/fusion-pixel-font-12px-proportional-ttf.woff2-v2026.02.27.zip';

async function run() {
  console.log('Downloading...');
  const res = await fetch(url);
  
  if (!res.ok) throw new Error(`Failed to fetch: ${res.statusText}`);
  
  console.log('Extracting...');
  const buffer = Buffer.from(await res.arrayBuffer());
  const directory = await unzipper.Open.buffer(buffer);
  
  for (const file of directory.files) {
    console.log('Checking:', file.path);
    if (file.path.includes('zh_hans.ttf.woff2')) {
      console.log('Found font file:', file.path);
      const fileBuffer = await file.buffer();
      fs.writeFileSync('./public/fusion-pixel.woff2', fileBuffer);
      console.log('Saved to public/fusion-pixel.woff2');
      return;
    }
  }
  console.log('File not found in zip');
}

run().catch(console.error);
