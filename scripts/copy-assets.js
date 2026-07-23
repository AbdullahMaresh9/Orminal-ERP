const fs = require('fs');
const path = require('path');

function copyFolderSync(from, to) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(to, { recursive: true });
  fs.readdirSync(from).forEach(element => {
    const fromPath = path.join(from, element);
    const toPath = path.join(to, element);
    if (fs.lstatSync(fromPath).isDirectory()) {
      copyFolderSync(fromPath, toPath);
    } else {
      fs.copyFileSync(fromPath, toPath);
    }
  });
}

try {
  console.log('Copying static files...');
  copyFolderSync('.next/static', '.next/standalone/.next/static');
  console.log('Copying public assets...');
  copyFolderSync('public', '.next/standalone/public');
  console.log('Assets copied successfully!');
} catch (error) {
  console.error('Error copying assets:', error);
  process.exit(1);
}
