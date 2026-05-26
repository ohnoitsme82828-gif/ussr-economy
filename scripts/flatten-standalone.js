const fs = require('fs');
const path = require('path');

function flattenStandalone() {
  const nestedPath = path.join('.next', 'standalone', 'SOV_BANK');
  const standaloneRoot = path.join('.next', 'standalone');
  
  console.log('🔧 Flattening nested standalone directory structure...');

  try {
    // Step 1: Move contents from .next/standalone/SOV_BANK to .next/standalone
    if (fs.existsSync(nestedPath)) {
      const nestedContents = fs.readdirSync(nestedPath);

      for (const item of nestedContents) {
        const sourcePath = path.join(nestedPath, item);
        const destPath = path.join(standaloneRoot, item);

        if (fs.existsSync(destPath)) {
          const stats = fs.lstatSync(destPath);
          if (stats.isDirectory()) {
            fs.rmSync(destPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(destPath);
          }
        }

        fs.cpSync(sourcePath, destPath, { recursive: true, force: true });
        console.log(`  ✓ Moved: ${item}`);
      }

      fs.rmSync(nestedPath, { recursive: true, force: true });
      console.log('  ✓ Removed nested SOV_BANK directory');
    }

    // Step 2: Move .next build artifacts from .next/standalone/.next to .next/standalone
    const nestedBuildPath = path.join(standaloneRoot, '.next');
    if (fs.existsSync(nestedBuildPath)) {
      console.log('  ✓ Unwrapping .next build artifacts...');
      const buildContents = fs.readdirSync(nestedBuildPath);

      for (const item of buildContents) {
        const sourcePath = path.join(nestedBuildPath, item);
        const destPath = path.join(standaloneRoot, item);

        if (fs.existsSync(destPath)) {
          const stats = fs.lstatSync(destPath);
          if (stats.isDirectory()) {
            fs.rmSync(destPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(destPath);
          }
        }

        fs.cpSync(sourcePath, destPath, { recursive: true, force: true });
      }

      fs.rmSync(nestedBuildPath, { recursive: true, force: true });
      console.log(`  ✓ Moved ${buildContents.length} build artifacts to root`);
    }

    // Verify routes-manifest.json exists at the root
    const routesManifestPath = path.join(standaloneRoot, 'routes-manifest.json');
    if (fs.existsSync(routesManifestPath)) {
      console.log('✅ Standalone structure flattened successfully');
      console.log(`✓ routes-manifest.json found at: ${routesManifestPath}\n`);
    } else {
      console.error('❌ routes-manifest.json not found at expected location');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Flattening failed:', error.message);
    process.exit(1);
  }
}

flattenStandalone();
