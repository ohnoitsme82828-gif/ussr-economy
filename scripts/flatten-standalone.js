const fs = require('fs');
const path = require('path');

// Post-build script to flatten nested standalone directory structure
async function flattenStandalone() {
  const nestedPath = path.join('.next', 'standalone', 'SOV_BANK');
  const standaloneRoot = path.join('.next', 'standalone');
  
  // Check if the nested directory exists
  if (!fs.existsSync(nestedPath)) {
    console.log('✓ Standalone directory is already flat');
    return;
  }

  console.log('🔧 Flattening nested standalone directory...');

  try {
    // Get all contents from nested directory
    const nestedContents = fs.readdirSync(nestedPath);

    // Move each item to the root of standalone
    for (const item of nestedContents) {
      const sourcePath = path.join(nestedPath, item);
      const destPath = path.join(standaloneRoot, item);

      // Remove existing destination if it exists
      if (fs.existsSync(destPath)) {
        if (fs.lstatSync(destPath).isDirectory()) {
          fs.rmSync(destPath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(destPath);
        }
      }

      // Move file/directory
      fs.cpSync(sourcePath, destPath, { recursive: true });
      console.log(`  ✓ Moved ${item}`);
    }

    // Remove the empty nested directory
    fs.rmSync(nestedPath, { recursive: true, force: true });
    
    // Clean up parent SOV_BANK directory if empty
    const parentDir = path.join('.next', 'standalone', 'SOV_BANK');
    if (fs.existsSync(parentDir)) {
      const contents = fs.readdirSync(parentDir);
      if (contents.length === 0) {
        fs.rmdirSync(parentDir);
      }
    }

    console.log('✅ Standalone directory flattened successfully');
  } catch (error) {
    console.error('❌ Error flattening standalone directory:', error);
    process.exit(1);
  }
}

flattenStandalone();
