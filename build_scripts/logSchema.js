import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Convert the file URL to a directory path
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Define the path to the schema file
const schemaPath = path.join(__dirname, '../typeDefs.ts');

// Log the schema content
console.log('Schema content:');
console.log(fs.readFileSync(schemaPath, 'utf-8'));
