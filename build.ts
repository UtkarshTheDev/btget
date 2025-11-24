#!/usr/bin/env bun

// Bun Build configuration for maximum CLI performance
import { BuildConfig } from 'bun';

const buildConfig: BuildConfig = {
  entrypoints: ['./src/index.ts'],
  outdir: './dist',
  target: 'node',
  format: 'esm',
  minify: {
    syntax: true,
    whitespace: true,
    identifiers: true
  },
  sourcemap: 'none',
  splitting: false, // Single file for CLI
  external: [], // Bundle everything for maximum performance
  naming: {
    entry: 'index.js',
    chunk: '[name]-[hash].js',
    asset: '[name]-[hash].[ext]'
  },
  loader: {
    '.ts': 'ts',
    '.js': 'js'
  },
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  // Aggressive CLI optimizations for maximum performance
  drop: [], // Keep console for CLI output
  treeShaking: true,
  bundle: true,
  // Additional performance optimizations
  packages: 'bundle', // Bundle all dependencies
  conditions: ['node'] // Optimize for Node.js environment
};

console.log('🚀 Building with Bun for maximum CLI performance...');
const result = await Bun.build(buildConfig);

if (result.success) {
  console.log('✅ Build completed successfully!');
  console.log(`📦 Generated ${result.outputs.length} output file(s)`);
  
  // Show bundle size for performance analysis
  for (const output of result.outputs) {
    const size = (await output.arrayBuffer()).byteLength;
    const sizeKB = (size / 1024).toFixed(2);
    console.log(`   📄 ${output.path}: ${sizeKB} KB`);
  }
  
  // Post-build optimizations for CLI
  console.log('🔧 Applying CLI optimizations...');
  
  // Add shebang for direct execution
  const indexPath = './dist/index.js';
  const content = await Bun.file(indexPath).text();
  const shebangedContent = `#!/usr/bin/env node\n${content}`;
  await Bun.write(indexPath, shebangedContent);
  
  // Make executable (Unix systems)
  if (process.platform !== 'win32') {
    const { spawn } = require('child_process');
    spawn('chmod', ['+x', indexPath], { stdio: 'inherit' });
  }
  
  console.log('🎉 CLI build optimized for maximum performance!');
  console.log(`🚀 Global install: npm install -g . `);
  console.log(`🎯 Usage: bittorrent-client download <torrent> -o <output>`);
  
} else {
  console.error('❌ Build failed!');
  for (const message of result.logs) {
    console.error(message);
  }
  process.exit(1);
}