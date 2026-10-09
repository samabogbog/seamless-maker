/* Run in one process: also works where the sandbox forbids child-process spawn. */
const fs = require('node:fs');
const path = require('node:path');
const tests = path.join(__dirname, '../tests');
for (const name of fs.readdirSync(tests).filter(name => name.endsWith('.test.js')).sort()) {
  require(path.join(tests, name));
}
