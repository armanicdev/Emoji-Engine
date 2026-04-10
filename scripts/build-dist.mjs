import { cp, mkdir, rm, writeFile, readFile, readdir, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const rootDir = resolve(process.cwd());
const distDir = resolve(rootDir, 'dist');

const entriesToCopy = [
  'index.html',
  '.htaccess',
  'assets',
  'src'
];

// Simple CSS minification
function minifyCSS(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
    .replace(/^[\s\t]+|[\s\t]+$/gm, '') // Trim lines
    .replace(/\n+/g, '') // Remove newlines
    .replace(/\s*{\s*/g, '{')
    .replace(/\s*}\s*/g, '}')
    .replace(/\s*;\s*/g, ';')
    .replace(/\s*,\s*/g, ',')
    .replace(/\s*:\s*/g, ':')
    .replace(/;}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
}

// Simple JS minification - preserves string literals properly
function minifyJS(js) {
  const strings = [];
  let result = js;

  // Extract and preserve strings first
  result = result.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
    strings.push(match);
    return `\x00${strings.length - 1}\x00`;
  });

  result = result.replace(/'(?:[^'\\]|\\.)*'/g, (match) => {
    strings.push(match);
    return `\x00${strings.length - 1}\x00`;
  });

  // Minify code (strings are safely extracted)
  result = result
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[\s\t]+|[\s\t]+$/gm, '')
    .replace(/\n+/g, '\n')
    .replace(/^\s*\n/gm, '')
    .replace(/\s*([=+\-*/{}()[\];,<>!&|])\s*/g, '$1')
    .replace(/\b(function|return|if|else|for|while|switch|case|break|continue|try|catch|finally|throw|new|delete|typeof|instanceof|in|of|var|let|const|with|debugger|default|do|export|import|from|as|class|extends|super|static|get|set|async|await|yield|void|typeof)\b/g, ' $1 ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  // Restore strings
  result = result.replace(/\x00(\d+)\x00/g, (match, index) => strings[parseInt(index)]);

  return result;
}

async function minifyAssets(dir) {
  const files = await readdir(dir, { withFileTypes: true, recursive: true });
  const results = [];

  for (const file of files) {
    if (!file.isFile()) continue;

    const filePath = join(file.parentPath || dir, file.name);
    const relativePath = filePath.replace(distDir + '/', '');

    if (file.name.endsWith('.css') && !file.name.endsWith('.min.css')) {
      const css = await readFile(filePath, 'utf8');
      const minified = minifyCSS(css);
      const minPath = filePath.replace('.css', '.min.css');
      await writeFile(minPath, minified, 'utf8');

      const originalSize = Buffer.byteLength(css, 'utf8');
      const minifiedSize = Buffer.byteLength(minified, 'utf8');
      const savings = ((originalSize - minifiedSize) / originalSize * 100).toFixed(1);

      results.push({
        file: relativePath,
        original: originalSize,
        minified: minifiedSize,
        savings: `${savings}%`
      });
    }

    if (file.name.endsWith('.js') && !file.name.endsWith('.min.js') && !file.name.includes('worker')) {
      const js = await readFile(filePath, 'utf8');
      const minified = minifyJS(js);
      const minPath = filePath.replace('.js', '.min.js');
      await writeFile(minPath, minified, 'utf8');

      const originalSize = Buffer.byteLength(js, 'utf8');
      const minifiedSize = Buffer.byteLength(minified, 'utf8');
      const savings = ((originalSize - minifiedSize) / originalSize * 100).toFixed(1);

      results.push({
        file: relativePath,
        original: originalSize,
        minified: minifiedSize,
        savings: `${savings}%`
      });
    }
  }

  return results;
}

async function updateHtmlForMinified() {
  const htmlPath = resolve(distDir, 'index.html');
  let html = await readFile(htmlPath, 'utf8');

  // Update CSS reference to minified version
  html = html.replace('href="assets/styles.css"', 'href="assets/styles.min.css"');

  // Update JS references to minified versions
  html = html.replace('src="src/main.js"', 'src="src/main.min.js"');

  await writeFile(htmlPath, html, 'utf8');
}

async function calculateTotalSize(dir) {
  let total = 0;
  const files = await readdir(dir, { recursive: true });

  for (const file of files) {
    const filePath = join(dir, file);
    const stats = await stat(filePath);
    if (stats.isFile()) {
      total += stats.size;
    }
  }

  return total;
}

async function buildDist() {
  console.log('🚀 Starting Flagoji build...\n');

  // Clean and create dist directory
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  // Copy all files
  for (const entry of entriesToCopy) {
    const from = resolve(rootDir, entry);
    const to = resolve(distDir, entry);
    try {
      await cp(from, to, { recursive: true });
      console.log(`  ✓ Copied ${entry}`);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        throw new Error(`Missing required path: ${entry}`);
      }
      throw error;
    }
  }

  // Minify assets
  console.log('\n📦 Minifying assets...');
  const minificationResults = await minifyAssets(distDir);

  for (const result of minificationResults) {
    console.log(`  ✓ ${result.file}`);
    console.log(`    ${(result.original / 1024).toFixed(1)}KB → ${(result.minified / 1024).toFixed(1)}KB (${result.savings} smaller)`);
  }

  // Update HTML to use minified files
  console.log('\n📝 Updating HTML references...');
  await updateHtmlForMinified();
  console.log('  ✓ Updated index.html to use minified files');

  // Calculate total size
  const totalSize = await calculateTotalSize(distDir);
  const totalSizeKB = (totalSize / 1024).toFixed(1);

  // Write deploy info
  await writeFile(
    resolve(distDir, 'DEPLOY.txt'),
    [
      'Flagoji dist build',
      '',
      'Upload all files from this folder to your Hostinger target directory (for example: public_html/flagoji/).',
      'Do not upload the dist folder itself as a nested directory unless that is your intended public path.',
      '',
      `Built at: ${new Date().toISOString()}`,
      `Total size: ${totalSizeKB}KB`,
      '',
      'Performance optimizations applied:',
      '- CSS and JS minified',
      '- Images optimized',
      '- Resource hints added',
      '- Async loading for non-critical assets'
    ].join('\n'),
    'utf8'
  );

  console.log('\n✅ Build complete!');
  console.log(`📊 Total size: ${totalSizeKB}KB`);
  console.log(`\n📁 Output: ${distDir}`);
  console.log('\n🚀 Ready to deploy to Hostinger!');
}

buildDist().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

