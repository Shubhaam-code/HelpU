import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const brainDir = 'C:\\Users\\Shubham Narayan\\.gemini\\antigravity\\brain\\c2e9315e-1520-410e-a8d5-204681060e3a';
const screenshotsDir = path.join(__dirname, 'screenshots');

if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

// Locate Chrome
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
if (!fs.existsSync(chromePath)) {
  throw new Error(`Chrome not found at ${chromePath}`);
}

// Find built CSS file
const assetsDir = path.join(__dirname, 'dist', 'assets');
const cssFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.css'));
const cssContent = cssFiles.map(f => fs.readFileSync(path.join(assetsDir, f), 'utf8')).join('\n');

// Read webpage.png as base64
const webpageImgPath = path.join(__dirname, 'public', 'webpage.png');
const webpageBase64 = `data:image/png;base64,${fs.readFileSync(webpageImgPath).toString('base64')}`;

// Template for exact Home Page with Updated Hero Section
function generateHomePageHtml(screenWidth) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Helpu Home - ${screenWidth}px</title>
  <style>
    ${cssContent}
    * { box-sizing: border-box; }
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: #FFF8F3;
      color: #17233C;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .screen-container {
      width: ${screenWidth}px !important;
      max-width: ${screenWidth}px !important;
      min-height: 840px;
      margin: 0 !important;
      padding-bottom: 74px;
      position: relative;
      background-color: #FFF8F3;
      overflow-x: hidden;
    }
  </style>
</head>
<body class="bg-[#FFF8F3]">

  <div class="screen-container">
    <!-- Mobile Top Header -->
    <header class="w-full bg-[#FFF8F3] px-3.5 pt-3 pb-2 flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-xl bg-[#FF572E] text-white font-black flex items-center justify-center text-sm shadow-xs">
          H
        </div>
        <span class="font-black text-xl text-[#17233C] tracking-tight">Helpu</span>
      </div>
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-full bg-white border border-[#F4E3D8] flex items-center justify-center text-[#6E7587] shadow-2xs">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>
        </div>
        <div class="w-8 h-8 rounded-full bg-[#FFEBE0] border border-[#F4E3D8] overflow-hidden flex items-center justify-center text-xs font-black text-[#FF572E]">
          SN
        </div>
      </div>
    </header>

    <!-- Main Container -->
    <main class="w-full px-3 min-[360px]:px-3.5 pt-1 space-y-3.5">

      <!-- 1. Welcome Greeting -->
      <div class="px-0.5">
        <div class="flex items-center gap-1.5">
          <h2 class="font-black text-[#17233C] text-lg tracking-tight">
            Welcome back, Shubham
          </h2>
          <span class="text-lg">👋</span>
        </div>
        <p class="text-xs text-[#6E7587] font-medium flex items-center gap-1 mt-0.5">
          <span class="text-[#FF572E]">📍</span>
          <span>VIT, Bhopal</span>
        </p>
      </div>

      <!-- 2. HERO ACTION CARD WITH PROMINENT ILLUSTRATION -->
      <div class="relative bg-white rounded-[22px] min-[360px]:rounded-[24px] border border-[#F4E3D8] shadow-xs overflow-hidden p-3 min-[360px]:p-3.5">
        
        <!-- Subtle warm glow background -->
        <div class="absolute top-0 right-0 left-0 h-32 bg-gradient-to-b from-[#FFF5EE] to-transparent pointer-events-none"></div>

        <!-- Content Row: Text + Visual Hero Illustration -->
        <div class="relative z-10 flex items-center justify-between gap-1.5 min-[360px]:gap-2">
          <div class="flex-1 min-w-0 pr-0.5">
            
            <!-- Tag / Badge -->
            <div class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FFF3EC] border border-[#FDE0D0] text-[#FF572E] text-[9px] min-[360px]:text-[10px] font-black uppercase tracking-wider mb-1.5 min-[360px]:mb-2 shadow-2xs">
              <span>✨</span>
              <span class="truncate">Campus Travel</span>
            </div>

            <h1 class="font-black text-[#17233C] text-[17px] min-[360px]:text-[18.5px] min-[390px]:text-[20px] leading-[1.15] tracking-tight">
              Where are you <br />
              heading <span class="text-[#FF572E]">today?</span>
            </h1>
            <p class="text-[10.5px] min-[360px]:text-[11.5px] text-[#6E7587] font-medium leading-relaxed mt-1 line-clamp-3">
              Connect with fellow students, share vehicle rides, and split cab fares seamlessly.
            </p>
          </div>

          <!-- Right Illustration: Prominent, Crisp & Visually Balanced (1.5x-1.8x Presence) -->
          <div 
            class="shrink-0 w-[145px] min-[360px]:w-[165px] min-[375px]:w-[180px] min-[390px]:w-[195px] min-[470px]:w-[220px] sm:w-[260px] md:w-[300px] lg:w-[340px] -mr-1 min-[360px]:-mr-2 sm:-mr-4 flex justify-end items-center"
            style="max-width: 54%;"
          >
            <img
              src="${webpageBase64}"
              alt="Helpu Student Travel"
              class="w-full h-auto max-h-[140px] sm:max-h-[195px] object-contain select-none pointer-events-none drop-shadow-xs"
            />
          </div>
        </div>

        <!-- 2 Primary Action Buttons: Offer a Ride & Find a Ride -->
        <div class="relative z-10 grid grid-cols-2 gap-2 min-[360px]:gap-2.5 pt-3 mt-2 border-t border-[#F4E3D8]/60">
          <button class="w-full py-2 min-[360px]:py-2.5 px-2 bg-[#FF572E] hover:bg-[#E64A22] text-white rounded-full font-black text-[11px] min-[360px]:text-xs shadow-md shadow-[#FF572E]/20 flex items-center justify-center gap-1.5 cursor-pointer">
            <span>🚗</span>
            <span>Offer a Ride</span>
          </button>

          <button class="w-full py-2 min-[360px]:py-2.5 px-2 bg-white hover:bg-[#FFF7F2] border border-[#F4E3D8] hover:border-[#FF572E]/40 text-[#17233C] rounded-full font-bold text-[11px] min-[360px]:text-xs shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer">
            <span class="text-[#FF572E]">🔍</span>
            <span>Find a Ride</span>
          </button>
        </div>
      </div>

      <!-- 3. Route Search Bar -->
      <div class="relative w-full">
        <div class="bg-white rounded-xl py-2 px-3 border border-[#F4E3D8] shadow-xs flex items-center justify-between gap-2">
          <span class="text-[#8C93A4] text-xs">🔍</span>
          <input
            type="text"
            placeholder="Search destination, airport, railway..."
            class="w-full bg-transparent text-[11px] min-[360px]:text-xs font-semibold text-[#17233C] placeholder:text-[#8C93A4] focus:outline-none"
            disabled
          />
          <button class="px-2.5 py-1 bg-[#FFF4ED] text-[#FF572E] text-[11px] font-black rounded-lg shrink-0">
            Search
          </button>
        </div>
      </div>

      <!-- 4. Upcoming Confirmed Rides -->
      <div class="bg-white rounded-[22px] min-[360px]:rounded-[24px] p-3.5 border border-[#F4E3D8] shadow-xs space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span class="text-emerald-600 text-xs">✅</span>
            <h3 class="font-black text-[#17233C] text-xs min-[360px]:text-sm">Upcoming Confirmed Rides</h3>
          </div>
          <span class="text-[11px] font-bold text-[#FF572E] flex items-center gap-0.5 cursor-pointer">
            See All →
          </span>
        </div>

        <div class="py-5 flex flex-col items-center justify-center text-center space-y-1.5">
          <div class="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center text-xs">
            ✓
          </div>
          <p class="font-black text-[#17233C] text-xs">No confirmed rides yet</p>
          <p class="text-[10.5px] text-[#6E7587] max-w-[240px]">
            When you confirm a ride offer or request with another student, your trip itinerary will appear right here.
          </p>
        </div>
      </div>

    </main>

    <!-- Bottom Navigation -->
    <nav class="absolute bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#F4E3D8] px-3 py-2 flex items-center justify-around shadow-lg">
      <div class="flex flex-col items-center gap-0.5 text-[9px] min-[360px]:text-[10px] font-black text-[#FF572E] cursor-pointer">
        <span class="text-sm">🏠</span>
        <span>Home</span>
        <div class="w-3.5 h-0.5 bg-[#FF572E] rounded-full mt-0.5"></div>
      </div>
      <div class="flex flex-col items-center gap-0.5 text-[9px] min-[360px]:text-[10px] font-bold text-[#6E7587] cursor-pointer">
        <span class="text-sm">🚗</span>
        <span>Ride</span>
      </div>
      <div class="flex flex-col items-center gap-0.5 text-[9px] min-[360px]:text-[10px] font-bold text-[#6E7587] cursor-pointer">
        <span class="text-sm">👥</span>
        <span>Matching</span>
      </div>
      <div class="flex flex-col items-center gap-0.5 text-[9px] min-[360px]:text-[10px] font-bold text-[#6E7587] cursor-pointer">
        <span class="text-sm">🚖</span>
        <span>Group</span>
      </div>
    </nav>
  </div>

</body>
</html>
  `;
}

const widths = [320, 360, 375, 390, 430];

console.log('📸 Generating Home Page Hero Illustration Responsive Screenshots...');

for (const w of widths) {
  const htmlPath = path.join(screenshotsDir, `home_hero_${w}px.html`);
  const pngName = `home_hero_${w}px.png`;
  const pngPath = path.join(screenshotsDir, pngName);
  const brainPngPath = path.join(brainDir, pngName);

  const html = generateHomePageHtml(w);
  fs.writeFileSync(htmlPath, html, 'utf8');

  // Viewport height 840px
  const cmd = `"${chromePath}" --headless --disable-gpu --hide-scrollbars --screenshot="${pngPath}" --window-size=${w},840 "${htmlPath}"`;
  execSync(cmd, { stdio: 'ignore' });
  fs.copyFileSync(pngPath, brainPngPath);
  console.log(`  ✅ [${w}px] Captured -> ${pngName} (saved to artifacts)`);
}

console.log('🎉 All responsive screenshots generated successfully!');
