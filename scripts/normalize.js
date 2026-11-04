const fs = require('fs');
const files = process.argv.slice(2);
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  fs.writeFileSync(f, t.replace(/\r\n/g, '\n'));
}
console.log('normalized', files.join(', '));
