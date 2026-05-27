#!/usr/bin/env node
/**
 * Pre-Deployment Verification Script
 * Checks that all fixes are applied correctly before pushing to Vercel
 */

const fs = require('fs');
const path = require('path');

const checks = [];

function addCheck(name, passed, details = '') {
  checks.push({ name, passed, details });
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${name}${details ? ' - ' + details : ''}`);
}

console.log('\n🔍 Pre-Deployment Verification\n');

// Check 1: route.js has global try-catch
const routeFile = fs.readFileSync(path.join(__dirname, 'app/api/[[...path]]/route.js'), 'utf8');

console.log('Backend (route.js):');
addCheck(
  'Global GET handler error wrapper',
  routeFile.includes('export async function GET(request) {') && 
  routeFile.includes('} catch (error) {') &&
  routeFile.includes('console.error(\'GET handler error')
);

addCheck(
  'Global POST handler error wrapper',
  routeFile.includes('export async function POST(request) {') &&
  routeFile.includes('console.error(\'POST handler error')
);

addCheck(
  'Health check endpoint',
  routeFile.includes('async function handleHealth(request)') &&
  routeFile.includes('if (path === \'health\')')
);

addCheck(
  'handleLogin DB initialization try-catch',
  routeFile.includes('async function handleLogin(request) {') &&
  routeFile.includes('try {') &&
  routeFile.includes('await ensureDbInitialized();')
);

addCheck(
  'handleRegister DB initialization try-catch',
  routeFile.includes('async function handleRegister(request) {') &&
  routeFile.includes('try {') &&
  routeFile.match(/Database initialization error during registration/i)
);

addCheck(
  'Login rate limiting awaited',
  routeFile.includes('const rateLimitOk = await checkRateLimit(username, \'login\');')
);

addCheck(
  'Conversion rate limiting awaited',
  routeFile.includes('const conversionRateLimitOk = await checkRateLimit(user.id, \'conversion\');')
);

addCheck(
  'Purchase rate limiting awaited',
  routeFile.includes('const purchaseRateLimitOk = await checkRateLimit(user.id, \'purchase\');')
);

// Check 2: page.js has enhanced error handling
console.log('\nFrontend (page.js):');
const pageFile = fs.readFileSync(path.join(__dirname, 'app/page.js'), 'utf8');

addCheck(
  'Enhanced apiCall() with content-type check',
  pageFile.includes('const contentType = response.headers.get(\'content-type\');') &&
  pageFile.includes('if (!contentType?.includes(\'application/json\'))')
);

addCheck(
  'Enhanced apiCall() with empty response handling',
  pageFile.includes('const contentLength = response.headers.get(\'content-length\');') &&
  pageFile.includes('if (response.status === 204 || contentLength === \'0\')')
);

addCheck(
  'Enhanced apiCall() with safe JSON parsing',
  pageFile.includes('const text = await response.text();') &&
  pageFile.includes('if (!text) {') &&
  pageFile.includes('data = JSON.parse(text);')
);

addCheck(
  'Enhanced fetchUserData() with error handling',
  pageFile.includes('try {') &&
  pageFile.includes('let data;') &&
  pageFile.includes('data = await response.json();')
);

// Check 3: Configuration files
console.log('\nConfiguration:');

const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
addCheck(
  'MongoDB removed from dependencies',
  !packageJson.dependencies.mongodb,
  'Good - no unused dependencies'
);

const nextConfig = fs.readFileSync(path.join(__dirname, 'next.config.js'), 'utf8');
addCheck(
  'next.config.js has turbopack config',
  nextConfig.includes('turbopack: {'),
  'Resolves Turbopack warnings'
);

addCheck(
  'next.config.js is production ready',
  nextConfig.includes('output: \'standalone\''),
  'Can run standalone'
);

// Check 4: Documentation
console.log('\nDocumentation:');

const docs = [
  { name: 'API_FIXES_DOCUMENTATION.md', file: 'API_FIXES_DOCUMENTATION.md' },
  { name: 'QUICK_DEPLOY.md', file: 'QUICK_DEPLOY.md' },
  { name: 'FIX_SUMMARY.md', file: 'FIX_SUMMARY.md' },
];

docs.forEach(doc => {
  const exists = fs.existsSync(path.join(__dirname, doc.file));
  addCheck(
    `${doc.name} created`,
    exists,
    exists ? 'Found' : 'Missing'
  );
});

// Summary
console.log('\n📊 Summary\n');
const passed = checks.filter(c => c.passed).length;
const total = checks.length;
const percentage = Math.round((passed / total) * 100);

console.log(`Passed: ${passed}/${total} (${percentage}%)`);

if (percentage === 100) {
  console.log('\n✅ ALL CHECKS PASSED - Ready to deploy!\n');
  console.log('Next steps:');
  console.log('1. git add .');
  console.log('2. git commit -m "Fix: Comprehensive API error handling"');
  console.log('3. git push origin main');
  console.log('4. Wait 2-3 minutes for Vercel deployment');
  console.log('5. Test: GET /api/health');
  process.exit(0);
} else {
  console.log('\n❌ SOME CHECKS FAILED - Review the output above\n');
  const failed = checks.filter(c => !c.passed);
  console.log('Failed checks:');
  failed.forEach(f => console.log(`  - ${f.name}`));
  process.exit(1);
}
