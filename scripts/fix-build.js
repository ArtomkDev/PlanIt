const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, 'dist');

try {
  fs.writeFileSync(path.join(distPath, '.nojekyll'), '');
  console.log('✅ Created .nojekyll');
} catch (e) {
  console.error('Error creating .nojekyll:', e);
}

try {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf8');
    
    html = html.replace(/"\/_expo\//g, '"./_expo/');
    html = html.replace(/"\/favicon.ico"/g, '"./favicon.ico"');
    html = html.replace(/"\/assets\//g, '"./assets/');
    
    fs.writeFileSync(indexPath, html);
    console.log('✅ Fixed paths in index.html');
  } else {
    console.warn('⚠️ index.html not found!');
  }
} catch (e) {
  console.error('Error fixing index.html:', e);
}

try {
  const jsDir = path.join(distPath, '_expo', 'static', 'js', 'web');
  if (fs.existsSync(jsDir)) {
    const files = fs.readdirSync(jsDir);
    const indexJsFile = files.find(file => file.startsWith('index-') && file.endsWith('.js'));

    if (indexJsFile) {
      const jsPath = path.join(jsDir, indexJsFile);
      let jsContent = fs.readFileSync(jsPath, 'utf8');

      jsContent = jsContent.replaceAll('"/assets/', '"/planit-demo/assets/');

      fs.writeFileSync(jsPath, jsContent);
      console.log('✅ Fixed icon paths in JS bundle');
    }
  }
} catch (e) {
  console.error('Error fixing JS bundle:', e);
}


// npm run deploy