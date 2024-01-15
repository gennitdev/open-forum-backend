import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert the file URL to a directory path
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define the source and destination directories
const sourceDir = path.join(__dirname, '../customResolvers/cypher');
const destinationDir = path.join(__dirname, '../ts_emitted/customResolvers/cypher');

// Ensure destination directory exists
fs.mkdirSync(destinationDir, { recursive: true });

// Read files from the source directory
const files = fs.readdirSync(sourceDir);

files.forEach(file => {
  // Check if the file is a .cypher file
  if (path.extname(file) === '.cypher') {
    const sourceFile = path.join(sourceDir, file);
    const destinationFile = path.join(destinationDir, file);

    // Copy the file
    fs.copyFileSync(sourceFile, destinationFile);
    // console.log(`Copied: ${sourceFile} to ${destinationFile}`);
  }
});

console.log('Cypher files copied successfully!');