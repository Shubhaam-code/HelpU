import { execSync } from 'child_process';
import fs from 'fs';

const testHtml = `<!DOCTYPE html>
<html>
<head>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: #FFF8F3;
    }
    .mobile-frame {
      width: 390px;
      height: 840px;
      border: 4px solid red;
      background: white;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <div class="mobile-frame">
    <div style="padding: 16px; display: flex; justify-content: space-between;">
      <span>Top Left (Helpu)</span>
      <span>Top Right (Avatar)</span>
    </div>
    <div style="padding: 16px;">
      <h1>Mobile 390px View</h1>
    </div>
    <div style="padding: 16px; display: flex; justify-content: space-between;">
      <span>Home</span>
      <span>Ride</span>
      <span>Match</span>
      <span>Group</span>
    </div>
  </div>
</body>
</html>`;

fs.writeFileSync('c:/Users/Shubham Narayan/Desktop/Idea/frontend/screenshots/test_frame.html', testHtml);
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
execSync(`"${chrome}" --headless --disable-gpu --hide-scrollbars --screenshot="c:/Users/Shubham Narayan/Desktop/Idea/frontend/screenshots/test_frame.png" --window-size=390,840 "c:/Users/Shubham Narayan/Desktop/Idea/frontend/screenshots/test_frame.html"`);
console.log('Captured test_frame.png');

