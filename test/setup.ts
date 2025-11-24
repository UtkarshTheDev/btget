/**
 * Test setup and configuration
 */

import { beforeAll, afterAll, beforeEach, afterEach } from 'bun:test';
import { rmSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Test directories
export const TEST_DIR = join(process.cwd(), 'test');
export const FIXTURES_DIR = join(TEST_DIR, 'fixtures');
export const OUTPUT_DIR = join(TEST_DIR, 'output');
export const TEMP_DIR = join(TEST_DIR, 'temp');

// Clean up function
export function cleanTestDirs(): void {
  const dirsToClean = [OUTPUT_DIR, TEMP_DIR];
  
  for (const dir of dirsToClean) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}

// Setup test directories
export function setupTestDirs(): void {
  const dirsToCreate = [FIXTURES_DIR, OUTPUT_DIR, TEMP_DIR];
  
  for (const dir of dirsToCreate) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }
}

// Global test setup
beforeAll(() => {
  console.log('🧪 Setting up test environment...');
  setupTestDirs();
});

// Global test cleanup
afterAll(() => {
  console.log('🧹 Cleaning up test environment...');
  cleanTestDirs();
});

// Per-test cleanup
beforeEach(() => {
  // Clean temp directory before each test
  if (existsSync(TEMP_DIR)) {
    rmSync(TEMP_DIR, { recursive: true, force: true });
  }
  mkdirSync(TEMP_DIR, { recursive: true });
});

afterEach(() => {
  // Clean temp directory after each test
  if (existsSync(TEMP_DIR)) {
    rmSync(TEMP_DIR, { recursive: true, force: true });
  }
});