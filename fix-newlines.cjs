/**
 * Fix literal backslash-n characters in source files
 * This script replaces escaped newlines with actual newlines
 */
const fs = require('fs');
const path = require('path');

// Directories to skip
const skipDirs = ['node_modules', '.svelte-kit', 'build', 'dist', '.git'];

function shouldProcessFile(filePath) {
  // Skip binary files and certain extensions
  const skipExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.cjs'];
  const ext = path.extname(filePath).toLowerCase();
  if (skipExtensions.includes(ext)) return false;

  const parts = filePath.split(path.sep);
  return !parts.some(part => skipDirs.includes(part));
}

function fixFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Check if file has literal backslash-n characters
    if (content.includes('\\n')) {
      // Replace literal backslash-n with actual newlines
      // Also handle backslash-t for tabs
      const fixed = content
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t');

      fs.writeFileSync(filePath, fixed, 'utf8');
      console.log(`Fixed: ${filePath}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error(`Error processing ${filePath}:`, err.message);
    return false;
  }
}

function walkDir(dir) {
  let fixedCount = 0;

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (!skipDirs.includes(entry.name)) {
          fixedCount += walkDir(fullPath);
        }
      } else if (entry.isFile() && shouldProcessFile(fullPath)) {
        if (fixFile(fullPath)) {
          fixedCount++;
        }
      }
    }
  } catch (err) {
    console.error(`Error walking directory ${dir}:`, err.message);
  }

  return fixedCount;
}

// Start from current directory
const startDir = process.cwd();
console.log(`Starting to fix files in: ${startDir}\n`);

const fixedCount = walkDir(startDir);

console.log(`\nComplete! Fixed ${fixedCount} file(s).`);
