const fs = require('fs');
const path = require('path');

function flattenStandalone() {
  const nestedPath = path.join('.next', 'standalone', 'SOV_BANK');
  const standaloneRoot = path.join('.next', 'standalone');
  
  if (!fs.existsSync(nestedPath)) {
    console.log('✓ Standalone directory structure is already correct');
    return;
  }

  console.log('🔧 Flattening nested standalone directory structure...');

  try {
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
    console.log('✅ Standalone structure flattened successfully\n');
  } catch (error) {
    console.error('❌ Flattening failed:', error.message);
    process.exit(1);
  }
}

flattenStandalone();
