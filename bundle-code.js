const fs = require('fs');
const path = require('path');

const outputFile = 'tutto_il_progetto.txt';
const excludeDirs = ['node_modules', '.next', '.git', 'dist', 'build', 'coverage'];
const includeExtensions = ['.js', '.ts', '.tsx', '.json', '.env'];

let outputContent = '';

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (!excludeDirs.includes(file)) {
        walkDir(fullPath);
      }
    } else {
      const ext = path.extname(file);
      if (includeExtensions.includes(ext) || file === '.env') {
        const relativePath = path.relative(process.cwd(), fullPath);
        try {
          const content = fs.readFileSync(fullPath, 'utf8');
          outputContent += `\n\n==================================================\n`;
          outputContent += `FILE: ${relativePath}\n`;
          outputContent += `==================================================\n\n`;
          outputContent += content;
          console.log(`[OK] Aggiunto: ${relativePath}`);
        } catch (err) {
          console.log(`[SKIP] Impossibile leggere: ${relativePath}`);
        }
      }
    }
  }
}

console.log('Scansione e unione di tutti i file del progetto in corso...');
walkDir(process.cwd());

fs.writeFileSync(outputFile, outputContent, 'utf8');
console.log(`\nFatto! Il file cumulativo è pronto: ${path.resolve(outputFile)}`);