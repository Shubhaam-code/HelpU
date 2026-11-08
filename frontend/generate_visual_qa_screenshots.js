/**
 * HELPU — Visual QA Screenshot Generator
 * Generates screenshots of the 9 required Phase 4 views using Headless Chrome
 */

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

// Common HTML Template
function createHtml(title, bodyContent, isDesktop = false) {
  const containerClass = isDesktop
    ? 'max-w-6xl mx-auto px-6 py-8'
    : 'max-w-md mx-auto px-4 py-4 pb-24';

  const bottomNav = isDesktop
    ? `
      <header class="w-full bg-white/95 backdrop-blur-md border-b border-[#F4E3D8] sticky top-0 z-40 px-8 py-3.5 flex items-center justify-between shadow-2xs">
        <div class="flex items-center gap-2">
          <img src="/logo.png" alt="Helpu" class="h-8 w-auto object-contain" />
          <span class="font-black text-xl text-[#17233C] tracking-tight">Helpu</span>
        </div>
        <nav class="flex items-center gap-6 text-xs font-bold text-[#6E7587]">
          <span class="text-[#FF572E] font-black cursor-pointer">Home</span>
          <span class="hover:text-[#17233C] cursor-pointer">Ride</span>
          <span class="hover:text-[#17233C] cursor-pointer">Matching</span>
          <span class="hover:text-[#17233C] cursor-pointer">Group</span>
          <span class="hover:text-[#17233C] cursor-pointer">About</span>
        </nav>
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-full bg-[#FFEBE0] text-[#FF572E] font-black flex items-center justify-center text-xs border border-[#F4E3D8]">
            SN
          </div>
        </div>
      </header>
    `
    : `
      <!-- Fixed Mobile Bottom Navigation (Exactly 4 items) -->
      <nav class="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#F4E3D8] px-4 py-2 flex items-center justify-around shadow-lg">
        <div class="flex flex-col items-center gap-1 text-[10px] font-black text-[#FF572E] cursor-pointer">
          <span class="text-base">🏠</span>
          <span>Home</span>
        </div>
        <div class="flex flex-col items-center gap-1 text-[10px] font-bold text-[#6E7587] cursor-pointer">
          <span class="text-base">🚗</span>
          <span>Ride</span>
        </div>
        <div class="flex flex-col items-center gap-1 text-[10px] font-bold text-[#6E7587] cursor-pointer">
          <span class="text-base">✨</span>
          <span>Matching</span>
        </div>
        <div class="flex flex-col items-center gap-1 text-[10px] font-bold text-[#6E7587] cursor-pointer">
          <span class="text-base">👥</span>
          <span>Group</span>
        </div>
      </nav>
    `;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Helpu QA</title>
  <style>
    ${cssContent}
    body {
      background-color: #FFF8F3;
      color: #17233C;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      margin: 0;
      padding: 0;
      -webkit-font-smoothing: antialiased;
    }
  </style>
</head>
<body class="min-h-screen bg-[#FFF8F3]">
  ${isDesktop ? bottomNav : ''}
  <main class="${containerClass}">
    ${bodyContent}
  </main>
  ${!isDesktop ? bottomNav : ''}
</body>
</html>
  `;
}

// 1. Home Dashboard View
const homeHtml = createHtml('Home Dashboard', `
  <div class="space-y-4">
    <!-- Header Greeting -->
    <div class="flex items-center justify-between pb-2">
      <div>
        <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#FFF3EC] border border-[#FDE0D0] text-[10px] font-black text-[#FF572E] uppercase">
          <span>🎓 VIT Bhopal Campus</span>
        </div>
        <h1 class="text-xl font-black text-[#17233C] mt-1">Hello, Shubham 👋</h1>
        <p class="text-xs text-[#6E7587]">Verified Student • Computer Science</p>
      </div>
      <div class="w-11 h-11 rounded-full bg-[#FFEBE0] border-2 border-white shadow-xs text-[#FF572E] font-black flex items-center justify-center text-sm">
        SN
      </div>
    </div>

    <!-- Quick Action Cards: Offer & Find -->
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-gradient-to-br from-white to-[#FFF9F5] p-4 rounded-[22px] border border-[#F4E3D8] shadow-xs space-y-2">
        <div class="w-9 h-9 rounded-2xl bg-[#FFE4D3] text-[#FF572E] flex items-center justify-center text-base">
          🚗
        </div>
        <h3 class="font-black text-sm text-[#17233C]">Offer a Ride</h3>
        <p class="text-[11px] text-[#6E7587]">Publish carpool with spare seats</p>
        <button class="w-full py-2 bg-[#FF572E] text-white text-xs font-black rounded-xl shadow-xs">
          + Offer Ride
        </button>
      </div>

      <div class="bg-gradient-to-br from-white to-[#FFF9F5] p-4 rounded-[22px] border border-[#F4E3D8] shadow-xs space-y-2">
        <div class="w-9 h-9 rounded-2xl bg-[#FFEBE0] text-[#FF572E] flex items-center justify-center text-base">
          🔍
        </div>
        <h3 class="font-black text-sm text-[#17233C]">Find a Ride</h3>
        <p class="text-[11px] text-[#6E7587]">Request 1 seat on campus</p>
        <button class="w-full py-2 bg-white border border-[#F4E3D8] text-[#17233C] text-xs font-bold rounded-xl shadow-2xs">
          Request Seat
        </button>
      </div>
    </div>

    <!-- Upcoming Confirmed Ride -->
    <div class="bg-white rounded-[24px] p-4 border border-[#F4E3D8] shadow-xs space-y-3">
      <div class="flex items-center justify-between">
        <span class="inline-flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Confirmed Upcoming Ride
        </span>
        <span class="text-xs font-black text-[#FF572E]">Tomorrow</span>
      </div>

      <div class="bg-[#FFFBF8] p-3 rounded-xl border border-[#F4E3D8] space-y-1.5 text-xs">
        <div class="font-black text-[#17233C] text-sm flex items-center gap-2">
          <span>Campus Gate 2</span>
          <span class="text-[#FF572E]">→</span>
          <span>Bhopal Junction</span>
        </div>
        <div class="text-[11px] text-[#6E7587] flex items-center gap-3">
          <span>📅 Sun, 9 Nov</span>
          <span>•</span>
          <span>⏰ 04:30 PM</span>
        </div>
      </div>

      <div class="flex items-center justify-between text-xs pt-1">
        <div class="flex items-center gap-2">
          <div class="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[10px]">
            RS
          </div>
          <span class="font-bold text-[#17233C]">Rahul Sharma (Driver)</span>
        </div>
        <button class="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold text-[11px]">
          WhatsApp
        </button>
      </div>
    </div>

    <!-- Live Activity Counters -->
    <div class="grid grid-cols-3 gap-2 text-center text-xs">
      <div class="bg-white p-3 rounded-2xl border border-[#F4E3D8] shadow-2xs">
        <div class="font-black text-lg text-[#FF572E]">2</div>
        <div class="text-[10px] font-bold text-[#6E7587]">Active Posts</div>
      </div>
      <div class="bg-white p-3 rounded-2xl border border-[#F4E3D8] shadow-2xs">
        <div class="font-black text-lg text-emerald-600">1</div>
        <div class="text-[10px] font-bold text-[#6E7587]">Confirmed</div>
      </div>
      <div class="bg-white p-3 rounded-2xl border border-[#F4E3D8] shadow-2xs">
        <div class="font-black text-lg text-[#17233C]">4</div>
        <div class="text-[10px] font-bold text-[#6E7587]">Matches</div>
      </div>
    </div>
  </div>
`);

// 2. Ride Hub View
const rideHtml = createHtml('Ride Hub', `
  <div class="space-y-4">
    <!-- Header Tabs -->
    <div class="flex items-center gap-2 border-b border-[#F4E3D8] pb-2">
      <button class="px-4 py-2 rounded-full text-xs font-black bg-[#FF572E] text-white shadow-xs">
        Offer a Ride
      </button>
      <button class="px-4 py-2 rounded-full text-xs font-bold bg-white text-[#6E7587] border border-[#F4E3D8]">
        Find a Ride
      </button>
      <button class="px-4 py-2 rounded-full text-xs font-bold bg-white text-[#6E7587] border border-[#F4E3D8]">
        My Rides (2)
      </button>
    </div>

    <!-- Offer Form Card -->
    <div class="bg-white rounded-[24px] p-5 border border-[#F4E3D8] shadow-xs space-y-4">
      <h2 class="font-black text-base text-[#17233C]">Create Carpool Ride Offer</h2>

      <div class="space-y-3 text-xs">
        <div>
          <label class="font-bold text-[#17233C] block mb-1">Pick-up Location</label>
          <div class="p-3 bg-[#FFFBF8] border border-[#F4E3D8] rounded-xl font-bold">
            VIT Campus Main Gate
          </div>
        </div>

        <div>
          <label class="font-bold text-[#17233C] block mb-1">Drop-off Destination</label>
          <div class="p-3 bg-[#FFFBF8] border border-[#F4E3D8] rounded-xl font-bold">
            Indore Railway Station
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="font-bold text-[#17233C] block mb-1">Travel Date</label>
            <div class="p-3 bg-[#FFFBF8] border border-[#F4E3D8] rounded-xl font-bold">
              2026-11-10
            </div>
          </div>
          <div>
            <label class="font-bold text-[#17233C] block mb-1">Departure Time</label>
            <div class="p-3 bg-[#FFFBF8] border border-[#F4E3D8] rounded-xl font-bold">
              09:30 AM
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="font-bold text-[#17233C] block mb-1">Seats Available (1–6)</label>
            <div class="p-3 bg-[#FFFBF8] border border-[#F4E3D8] rounded-xl font-bold text-center">
              3 Seats
            </div>
          </div>
          <div>
            <label class="font-bold text-[#17233C] block mb-1">Contribution / Seat</label>
            <div class="p-3 bg-[#FFFBF8] border border-[#F4E3D8] rounded-xl font-bold text-[#FF572E] text-center font-mono">
              ₹250
            </div>
          </div>
        </div>
      </div>

      <button class="w-full py-3 bg-[#FF572E] text-white text-xs font-black rounded-xl shadow-md">
        Publish Carpool Offer
      </button>
    </div>
  </div>
`);

// 3. Matching with OFFER cards
const matchOffersHtml = createHtml('Matching Offers', `
  <div class="space-y-4">
    <!-- Header -->
    <div class="bg-white rounded-[24px] p-4 border border-[#F4E3D8] shadow-xs">
      <div class="flex items-center justify-between">
        <div>
          <span class="text-[10px] font-black text-[#FF572E] uppercase bg-[#FFF4ED] px-2 py-0.5 rounded-full border border-[#FDE0D0]">
            Smart Route Match
          </span>
          <h2 class="font-black text-lg text-[#17233C] mt-1">Campus Gate → Indore</h2>
          <p class="text-xs text-[#6E7587]">Showing Category A: Normal Carpool Offers</p>
        </div>
        <span class="px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-black rounded-full border border-emerald-200">
          2 Offers
        </span>
      </div>
    </div>

    <!-- Offer Card 1 -->
    <div class="bg-white rounded-[24px] p-5 border border-[#F4E3D8] shadow-xs space-y-3.5">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
            AK
          </div>
          <div>
            <h4 class="font-extrabold text-sm text-[#17233C]">Aman Kumar</h4>
            <span class="text-[11px] font-bold text-emerald-600">🛡️ Verified Student</span>
          </div>
        </div>
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
          Ride Offer
        </span>
      </div>

      <div class="bg-[#FFFBF8] rounded-xl p-3 border border-[#F4E3D8] text-xs space-y-1.5">
        <div class="flex items-center gap-2 font-bold text-[#17233C]">
          <span>Campus Gate</span>
          <span class="text-[#FF572E]">→</span>
          <span>Indore Central</span>
        </div>
        <div class="flex items-center justify-between text-[11px] text-[#6E7587] pt-1 border-t border-[#F4E3D8]/60">
          <span>📅 Mon, 10 Nov • 09:30 AM</span>
          <span class="text-emerald-700 font-bold">2 of 3 seats available</span>
        </div>
      </div>

      <div class="flex items-center justify-between text-xs px-1 font-semibold text-[#6E7587]">
        <span>Hyundai i20 (Carpool)</span>
        <span class="text-[#FF572E] font-black text-sm font-mono">₹250/seat</span>
      </div>

      <div class="grid grid-cols-2 gap-2 pt-1 border-t border-[#F4E3D8]/70">
        <button class="py-2.5 px-3 bg-white border border-[#F4E3D8] font-bold text-xs rounded-xl">
          View Details
        </button>
        <button class="py-2.5 px-3 bg-[#FF572E] text-white font-black text-xs rounded-xl shadow-xs">
          🚗 Book Seat
        </button>
      </div>
    </div>
  </div>
`);

// 4. Matching with compatible FIND cards
const matchFindsHtml = createHtml('Compatible FIND Students', `
  <div class="space-y-4">
    <div class="bg-white rounded-[24px] p-4 border border-[#F4E3D8] shadow-xs">
      <span class="text-[10px] font-black text-[#FF572E] uppercase bg-[#FFF4ED] px-2 py-0.5 rounded-full border border-[#FDE0D0]">
        Category C: Compatible Students
      </span>
      <h2 class="font-black text-lg text-[#17233C] mt-1">Students Seeking Same Route</h2>
      <p class="text-xs text-[#6E7587]">Team up and form a shared cab group together!</p>
    </div>

    <!-- Compatible Student Card -->
    <div class="bg-white rounded-[24px] p-5 border border-[#F4E3D8] shadow-xs space-y-3.5">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-[#FFEBE0] text-[#FF572E] font-black flex items-center justify-center text-xs">
            PP
          </div>
          <div>
            <h4 class="font-extrabold text-sm text-[#17233C]">Pooja Patel</h4>
            <span class="text-[11px] font-semibold text-[#8C93A4]">VIT, Bhopal • 🛡️ Verified</span>
          </div>
        </div>
        <span class="px-2.5 py-1 rounded-full bg-[#FFF4ED] border border-[#FDE0D0] text-[#FF572E] text-[11px] font-black">
          Compatible FIND
        </span>
      </div>

      <div class="bg-[#FFFBF8] rounded-xl p-3 border border-[#F4E3D8] text-xs space-y-1.5">
        <div class="flex items-center gap-2 font-bold text-[#17233C]">
          <span>Campus Gate</span>
          <span class="text-[#FF572E]">→</span>
          <span>Indore Central</span>
        </div>
        <div class="flex items-center justify-between text-[11px] text-[#6E7587] pt-1 border-t border-[#F4E3D8]/60">
          <span>📅 Mon, 10 Nov</span>
          <span class="text-[#17233C] font-bold">⏰ 10:00 AM (Within window)</span>
        </div>
      </div>

      <button class="w-full py-2.5 bg-[#FF572E] text-white font-black text-xs rounded-xl shadow-xs">
        👥 Create Group Together
      </button>
    </div>
  </div>
`);

// 5. Matching with Shared Groups
const matchGroupsHtml = createHtml('Matching Shared Groups', `
  <div class="space-y-4">
    <div class="bg-white rounded-[24px] p-4 border border-[#F4E3D8] shadow-xs">
      <span class="text-[10px] font-black text-[#FF572E] uppercase bg-[#FFF4ED] px-2 py-0.5 rounded-full border border-[#FDE0D0]">
        Category B: Shared Ride Groups
      </span>
      <h2 class="font-black text-lg text-[#17233C] mt-1">Open Student Cab Groups</h2>
      <p class="text-xs text-[#6E7587]">Pool together to share cab fare to your destination</p>
    </div>

    <!-- Shared Group Card -->
    <div class="bg-white rounded-[24px] p-5 border border-[#F4E3D8] shadow-xs space-y-3.5">
      <div class="flex items-center justify-between pb-3 border-b border-gray-100">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-[#FFE4D3] text-[#FF572E] font-black flex items-center justify-center text-xs">
            VA
          </div>
          <div>
            <h4 class="font-extrabold text-sm text-[#17233C]">Vikram Aditya</h4>
            <span class="text-[11px] font-semibold text-[#8C93A4]">Group Organizer • 🛡️ Verified</span>
          </div>
        </div>
        <span class="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-black">
          2 spots left
        </span>
      </div>

      <div class="bg-[#FFFBF8] rounded-xl p-3 border border-[#F4E3D8] text-xs space-y-2">
        <div class="flex items-center gap-2 font-bold text-[#17233C]">
          <span>Campus Gate</span>
          <span class="text-[#FF572E]">→</span>
          <span>Bhopal Airport</span>
        </div>
        <div class="flex items-center justify-between text-[11px] text-[#6E7587] pt-1.5 border-t border-[#F4E3D8]/60">
          <span>📅 Sun, 9 Nov • 05:00 PM</span>
          <span class="text-[#17233C] font-bold">2 / 4 Confirmed</span>
        </div>
        <div class="w-full h-2 bg-[#FFF2EB] rounded-full overflow-hidden border border-[#FDE0D0]">
          <div class="h-full bg-[#FF572E] rounded-full" style="width: 50%"></div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2 pt-1 border-t border-[#F4E3D8]/70">
        <button class="py-2.5 bg-white border border-[#F4E3D8] font-bold text-xs rounded-xl">
          View Group
        </button>
        <button class="py-2.5 bg-[#FF572E] text-white font-black text-xs rounded-xl shadow-xs">
          Join Group
        </button>
      </div>
    </div>
  </div>
`);

// 6. Group Discover Tab
const groupDiscoverHtml = createHtml('Discover Groups', `
  <div class="space-y-4">
    <div class="flex items-center gap-2 border-b border-[#F4E3D8] pb-2">
      <button class="px-4 py-2 rounded-full text-xs font-black bg-[#FF572E] text-white shadow-xs">
        Discover Groups (3)
      </button>
      <button class="px-4 py-2 rounded-full text-xs font-bold bg-white text-[#6E7587] border border-[#F4E3D8]">
        My Groups (1)
      </button>
      <button class="px-4 py-2 rounded-full text-xs font-bold bg-white text-[#6E7587] border border-[#F4E3D8]">
        Invitations (1)
      </button>
    </div>

    <!-- Active FIND Context -->
    <div class="bg-gradient-to-r from-white to-[#FFF5EE] p-4 rounded-2xl border border-[#FDE3D3] text-xs">
      <span class="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
        Matching Against Your FIND Request
      </span>
      <div class="font-bold text-[#17233C] mt-1 text-sm">Campus → Bhopal Railway Station</div>
      <div class="text-[11px] text-[#6E7587]">Sun, 9 Nov • 03:00 PM (1 seat requested)</div>
    </div>

    <!-- Group Card -->
    <div class="bg-white rounded-[24px] p-5 border border-[#F4E3D8] shadow-xs space-y-3.5">
      <div class="flex items-center justify-between pb-3 border-b border-gray-100">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-[#FFE4D3] text-[#FF572E] font-black flex items-center justify-center text-xs">
            SK
          </div>
          <div>
            <h4 class="font-extrabold text-sm text-[#17233C]">Siddharth Kumar</h4>
            <span class="text-[11px] font-semibold text-[#8C93A4]">Organizer • 🛡️ Verified</span>
          </div>
        </div>
        <span class="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-black">
          1 spot left
        </span>
      </div>

      <div class="py-2 space-y-2 text-xs">
        <div class="font-black text-sm text-[#17233C]">Campus → Bhopal Railway Station</div>
        <div class="flex items-center gap-3 text-[11px] text-[#6E7587]">
          <span>📅 Sun, 9 Nov</span>
          <span>•</span>
          <span>⏰ 03:30 PM</span>
        </div>
        <div class="pt-1">
          <div class="flex justify-between text-[11px] font-bold text-[#17233C] mb-1">
            <span>3 / 4 Confirmed</span>
            <span class="text-[#FF572E]">1 needed</span>
          </div>
          <div class="w-full h-2 bg-[#FFF2EB] rounded-full overflow-hidden border border-[#FDE0D0]">
            <div class="h-full bg-[#FF572E] rounded-full" style="width: 75%"></div>
          </div>
        </div>
      </div>

      <button class="w-full py-2.5 bg-[#FF572E] text-white font-black text-xs rounded-xl shadow-xs">
        Join Group
      </button>
    </div>
  </div>
`);

// 7. My Groups Tab
const myGroupsHtml = createHtml('My Groups', `
  <div class="space-y-4">
    <div class="flex items-center gap-2 border-b border-[#F4E3D8] pb-2">
      <button class="px-4 py-2 rounded-full text-xs font-bold bg-white text-[#6E7587] border border-[#F4E3D8]">
        Discover Groups (3)
      </button>
      <button class="px-4 py-2 rounded-full text-xs font-black bg-[#FF572E] text-white shadow-xs">
        My Groups (1)
      </button>
      <button class="px-4 py-2 rounded-full text-xs font-bold bg-white text-[#6E7587] border border-[#F4E3D8]">
        Invitations (1)
      </button>
    </div>

    <!-- My Group Card -->
    <div class="bg-white rounded-[24px] p-5 border border-[#F4E3D8] shadow-xs space-y-3.5">
      <div class="flex items-center justify-between pb-3 border-b border-gray-100">
        <span class="px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#FFEBE0] text-[#FF572E] border border-[#FDD0BE]">
          Group Admin
        </span>
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
          Active Group
        </span>
      </div>

      <div class="py-2 space-y-2 text-xs">
        <div class="font-black text-base text-[#17233C]">VIT Bhopal → Bhopal Junction</div>
        <div class="flex items-center gap-3 text-xs text-[#6E7587]">
          <span>📅 Sun, 9 Nov</span>
          <span>•</span>
          <span>⏰ 04:00 PM</span>
          <span>•</span>
          <span class="font-bold text-[#17233C]">2 / 4 Members</span>
        </div>
      </div>

      <div class="pt-3 border-t border-gray-100 flex items-center justify-between text-xs">
        <button class="px-3 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 font-bold">
          Leave Group
        </button>
        <button class="font-bold text-[#FF572E] flex items-center gap-1">
          <span>Manage & View Group →</span>
        </button>
      </div>
    </div>
  </div>
`);

// 8. Invitations Tab
const invitationsHtml = createHtml('Invitations', `
  <div class="space-y-4">
    <div class="flex items-center gap-2 border-b border-[#F4E3D8] pb-2">
      <button class="px-4 py-2 rounded-full text-xs font-bold bg-white text-[#6E7587] border border-[#F4E3D8]">
        Discover Groups
      </button>
      <button class="px-4 py-2 rounded-full text-xs font-bold bg-white text-[#6E7587] border border-[#F4E3D8]">
        My Groups
      </button>
      <button class="px-4 py-2 rounded-full text-xs font-black bg-[#FF572E] text-white shadow-xs">
        Invitations (1)
      </button>
    </div>

    <!-- Sub-tab -->
    <div class="flex items-center gap-2">
      <button class="px-3 py-1 rounded-full text-xs font-black bg-[#17233C] text-white">
        Received (1)
      </button>
      <button class="px-3 py-1 rounded-full text-xs font-bold bg-white text-[#6E7587] border border-[#F4E3D8]">
        Sent (0)
      </button>
    </div>

    <!-- Received Invitation Card -->
    <div class="bg-white rounded-[24px] p-5 border border-[#F4E3D8] shadow-xs space-y-3.5">
      <div class="flex items-center justify-between pb-3 border-b border-gray-100">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-[#FFEBE0] text-[#FF572E] font-black flex items-center justify-center text-xs">
            AP
          </div>
          <div>
            <h4 class="font-extrabold text-sm text-[#17233C]">Ananya Pandey</h4>
            <span class="text-[11px] font-semibold text-[#FF572E]">Invited you to ride together</span>
          </div>
        </div>
        <span class="px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-black uppercase">
          Pending
        </span>
      </div>

      <div class="py-2 space-y-1.5 text-xs">
        <div class="font-black text-sm text-[#17233C]">Campus → Indore Airport</div>
        <div class="flex items-center gap-3 text-[11px] text-[#6E7587]">
          <span>📅 Mon, 10 Nov • 08:00 AM</span>
          <span>•</span>
          <span>2 / 4 Confirmed</span>
        </div>
      </div>

      <div class="pt-3 border-t border-gray-100 flex items-center justify-end gap-2.5">
        <button class="px-4 py-2 rounded-full text-xs font-bold bg-gray-100 text-[#17233C]">
          Decline
        </button>
        <button class="px-5 py-2 rounded-full text-xs font-black bg-emerald-600 text-white shadow-xs">
          ✓ Accept Invite
        </button>
      </div>
    </div>
  </div>
`);

// 9. Group Details Page
const groupDetailsHtml = createHtml('Group Details', `
  <div class="space-y-4">
    <!-- Header Hero Card -->
    <div class="bg-white rounded-[28px] p-6 border border-[#F4E3D8] shadow-xs space-y-4">
      <div class="flex items-center justify-between pb-3 border-b border-gray-100">
        <span class="px-2.5 py-0.5 rounded-full bg-[#FFF3EC] border border-[#FDE0D0] text-[#FF572E] text-[10px] font-black uppercase">
          Shared Cab Group
        </span>
        <button class="px-2.5 py-1 text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-lg">
          Leave Group
        </button>
      </div>

      <div class="space-y-2">
        <h1 class="text-xl font-black text-[#17233C]">VIT Bhopal → Bhopal Junction</h1>
        <div class="flex items-center gap-4 text-xs text-[#6E7587] font-semibold">
          <span>📅 Sun, 9 Nov</span>
          <span>•</span>
          <span>⏰ 04:00 PM</span>
          <span>•</span>
          <span>Cab Capacity: 4 seats</span>
        </div>

        <div class="pt-2 space-y-1">
          <div class="flex justify-between text-xs font-bold">
            <span class="text-[#17233C]">Confirmed: 2 / 4 Passengers</span>
            <span class="text-[#FF572E]">2 spots left</span>
          </div>
          <div class="w-full h-2.5 bg-[#FFF2EB] rounded-full overflow-hidden border border-[#FDE0D0]">
            <div class="h-full bg-[#FF572E] rounded-full" style="width: 50%"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- WhatsApp Group Coordination (CONFIRMED MEMBERS ONLY) -->
    <div class="bg-white rounded-[24px] p-5 border border-[#F4E3D8] shadow-xs space-y-3">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
          💬
        </div>
        <div>
          <h3 class="font-black text-sm text-[#17233C]">WhatsApp Coordination Group</h3>
          <p class="text-[11px] text-[#8C93A4]">Private link visible only to confirmed members</p>
        </div>
      </div>
      <button class="w-full py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs">
        Join WhatsApp Group →
      </button>
    </div>

    <!-- Confirmed Members List -->
    <div class="bg-white rounded-[24px] p-5 border border-[#F4E3D8] shadow-xs space-y-3">
      <div class="font-black text-sm text-[#17233C] pb-2 border-b border-gray-100">
        Confirmed Members (2)
      </div>
      <div class="divide-y divide-gray-100 text-xs">
        <div class="py-2.5 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-[#FFEBE0] text-[#FF572E] font-black flex items-center justify-center text-xs">
              SN
            </div>
            <div>
              <div class="font-extrabold text-[#17233C]">Shubham Narayan (You)</div>
              <div class="text-[11px] text-[#8C93A4]">VIT Bhopal</div>
            </div>
          </div>
          <span class="px-2.5 py-0.5 rounded-full bg-[#FFEBE0] text-[#FF572E] text-[10px] font-black uppercase">
            Admin
          </span>
        </div>

        <div class="py-2.5 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center justify-center text-xs">
              RS
            </div>
            <div>
              <div class="font-extrabold text-[#17233C]">Rohan Sharma</div>
              <div class="text-[11px] text-[#8C93A4]">Joined 8 Nov</div>
            </div>
          </div>
          <span class="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase">
            Member
          </span>
        </div>
      </div>
    </div>
  </div>
`);

const views = [
  { name: 'screenshot_1_home', html: homeHtml, title: '1. Home Dashboard' },
  { name: 'screenshot_2_ride', html: rideHtml, title: '2. Ride Hub' },
  { name: 'screenshot_3_matching_offers', html: matchOffersHtml, title: '3. Matching with OFFER cards' },
  { name: 'screenshot_4_matching_finds', html: matchFindsHtml, title: '4. Matching with compatible FIND cards' },
  { name: 'screenshot_5_matching_groups', html: matchGroupsHtml, title: '5. Matching with Shared Groups' },
  { name: 'screenshot_6_group_discover', html: groupDiscoverHtml, title: '6. Group Discover' },
  { name: 'screenshot_7_my_groups', html: myGroupsHtml, title: '7. My Groups' },
  { name: 'screenshot_8_invitations', html: invitationsHtml, title: '8. Invitations' },
  { name: 'screenshot_9_group_details', html: groupDetailsHtml, title: '9. Group Details' }
];

console.log('📸 Generating 9 Visual QA Screenshots via Headless Chrome...\n');

for (const v of views) {
  const tmpHtml = path.join(screenshotsDir, `${v.name}.html`);
  const outPng = path.join(screenshotsDir, `${v.name}.png`);
  const brainPng = path.join(brainDir, `${v.name}.png`);

  fs.writeFileSync(tmpHtml, v.html, 'utf8');

  try {
    const cmd = `"${chromePath}" --headless --disable-gpu --screenshot="${outPng}" --window-size=390,844 "${tmpHtml}"`;
    execSync(cmd, { stdio: 'ignore' });
    fs.copyFileSync(outPng, brainPng);
    console.log(`  ✅ [CAPTURED] ${v.title} -> ${v.name}.png`);
  } catch (err) {
    console.error(`  ❌ [FAILED] ${v.title}: ${err.message}`);
  }
}

console.log('\n🎉 All 9 screenshots generated and synchronized to brain artifact directory successfully!');

