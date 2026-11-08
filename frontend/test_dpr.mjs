import { execSync } from 'child_process';
import fs from 'fs';

const testHtml = `<!DOCTYPE html>
<html>
<body style="margin:0;">
  <h1 id="out" style="font-size: 16px;"></h1>
  <script>
    document.getElementById('out').textContent = 
      'innerWidth: ' + window.innerWidth + 
      ', outerWidth: ' + window.outerWidth + 
      ', dpr: ' + window.devicePixelRatio;
  </script>
</body>
</html>`;

fs.writeFileSync('c:/Users/Shubham Narayan/Desktop/Idea/frontend/screenshots/test_dpr.html', testHtml);
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
execSync(`"${chrome}" --headless --disable-gpu --screenshot="c:/Users/Shubham Narayan/Desktop/Idea/frontend/screenshots/test_dpr.png" --window-size=390,840 "c:/Users/Shubham Narayan/Desktop/Idea/frontend/screenshots/test_dpr.html"`);

