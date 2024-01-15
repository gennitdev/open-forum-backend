const ncp = require('ncp').ncp;
const path = require('path');
const fs = require('fs');

// The purpose of this script is so that the typescript emitted files
// have access to .cypher files at runtime. The typescript emitted files
// are located in ts_emitted/customResolvers/cypher/. The .cypher files
// are located in customResolvers/cypher/. This script copies the .cypher
// files to the ts_emitted/customResolvers/cypher/ directory.

const sourceDir = path.join(__dirname, 'customResolvers/cypher');
const destinationDir = path.join(__dirname, 'ts_emitted/customResolvers/cypher');

// Ensure destination directory exists
fs.mkdirSync(destinationDir, { recursive: true });

// Custom filter function to copy only .cypher files
function filterCypherFiles(source, destination) {
  return path.extname(source) === '.cypher';
}

ncp(sourceDir, destinationDir, { filter: filterCypherFiles }, function (err) {
 if (err) {
   return console.error(err);
 }
 console.log('Cypher files copied successfully!');
});
