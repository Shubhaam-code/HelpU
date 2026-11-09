const fs = require('fs');
const { execSync } = require('child_process');

const cssFile = fs.readdirSync('c:/Users/Shubham Narayan/Desktop/Idea/frontend/dist/assets').find(f => f.endsWith('.css'));
const cssContent = fs.readFileSync('c:/Users/Shubham Narayan/Desktop/Idea/frontend/dist/assets/' + cssFile, 'utf8');

// HTML for Page 1 & Page 2 & Page 3
const generateHTML = (content) => `<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width, initial-scale=1'>
  <style>
    ${cssContent}
  </style>
</head>
<body class='bg-[#FFFDF9] text-[#17233C]'>
  ${content}
</body>
</html>`;

// 1. PAGE 1: Match Posts
const page1Content = `
<div class='min-h-screen bg-[#FFFDF9] text-[#17233C] flex flex-col justify-between pb-24'>
  <header class='flex items-center justify-between px-4 sm:px-6 py-3 bg-[#FFF8F3]/95 backdrop-blur-md sticky top-0 z-30 border-b border-[#F4E3D8]'>
    <div class='flex items-center gap-3'>
      <div class='p-1 -ml-1 text-[#17233C]'>
        <svg class='w-5 h-5 text-[#17233C] stroke-[2.4]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='m12 19-7-7 7-7'/><path d='M19 12H5'/></svg>
      </div>
      <h1 class='font-black text-[#17233C] text-lg sm:text-xl tracking-tight'>Matches</h1>
    </div>
  </header>

  <main class='w-full max-w-xl mx-auto px-4 pt-4 space-y-4'>
    <!-- Pill Switcher -->
    <div class='w-full p-1 bg-white rounded-full border border-[#F4E3D8] shadow-2xs flex items-center justify-between'>
      <div class='flex-1 py-2 text-center text-xs sm:text-sm font-black rounded-full bg-[#FACC15] text-[#17233C] shadow-xs'>
        My Posts (3)
      </div>
      <div class='flex-1 py-2 text-center text-xs sm:text-sm font-bold rounded-full text-[#6E7587]'>
        All Matches
      </div>
    </div>

    <!-- Section Heading -->
    <div class='px-1 space-y-0.5'>
      <div class='flex items-center gap-1.5'>
        <span class='text-[#F59E0B] text-base leading-none'>✨</span>
        <h2 class='font-black text-base sm:text-lg text-[#17233C] tracking-tight'>Your Matches by Course</h2>
      </div>
      <p class='text-xs text-[#6E7587] font-medium'>Students matching your posted course & slot.</p>
    </div>

    <!-- Course Cards -->
    <div class='space-y-3'>
      <!-- Card 1 -->
      <div class='bg-white rounded-[22px] p-4 sm:p-5 border border-[#F4E3D8] shadow-xs flex items-center justify-between gap-3'>
        <div class='flex items-center gap-3.5 min-w-0 flex-1'>
          <div class='w-12 h-12 rounded-2xl bg-[#FEF9C3] text-[#D97706] flex items-center justify-center shrink-0 border border-[#FEF08A]'>
            <svg class='w-6 h-6 stroke-[2]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z'/><path d='M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'/></svg>
          </div>
          <div class='min-w-0 flex-1'>
            <h3 class='font-black text-sm sm:text-base text-[#17233C]'>CSE2001</h3>
            <p class='text-xs text-[#6E7587] font-medium mt-0.5'>Slot B1 • Dr. Rajesh Sharma</p>
            <div class='mt-1.5'>
              <span class='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]'>5 Matches</span>
            </div>
          </div>
        </div>
        <svg class='w-5 h-5 text-[#17233C] stroke-[2.2]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='m9 18 6-6-6-6'/></svg>
      </div>

      <!-- Card 2 -->
      <div class='bg-white rounded-[22px] p-4 sm:p-5 border border-[#F4E3D8] shadow-xs flex items-center justify-between gap-3'>
        <div class='flex items-center gap-3.5 min-w-0 flex-1'>
          <div class='w-12 h-12 rounded-2xl bg-[#FEF9C3] text-[#D97706] flex items-center justify-center shrink-0 border border-[#FEF08A]'>
            <svg class='w-6 h-6 stroke-[2]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z'/><path d='M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'/></svg>
          </div>
          <div class='min-w-0 flex-1'>
            <h3 class='font-black text-sm sm:text-base text-[#17233C]'>MAT2003</h3>
            <p class='text-xs text-[#6E7587] font-medium mt-0.5'>Slot A2 • Dr. Neha Gupta</p>
            <div class='mt-1.5'>
              <span class='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]'>4 Matches</span>
            </div>
          </div>
        </div>
        <svg class='w-5 h-5 text-[#17233C] stroke-[2.2]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='m9 18 6-6-6-6'/></svg>
      </div>

      <!-- Card 3 -->
      <div class='bg-white rounded-[22px] p-4 sm:p-5 border border-[#F4E3D8] shadow-xs flex items-center justify-between gap-3'>
        <div class='flex items-center gap-3.5 min-w-0 flex-1'>
          <div class='w-12 h-12 rounded-2xl bg-[#FEF9C3] text-[#D97706] flex items-center justify-center shrink-0 border border-[#FEF08A]'>
            <svg class='w-6 h-6 stroke-[2]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z'/><path d='M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'/></svg>
          </div>
          <div class='min-w-0 flex-1'>
            <h3 class='font-black text-sm sm:text-base text-[#17233C]'>PHY2001</h3>
            <p class='text-xs text-[#6E7587] font-medium mt-0.5'>Slot C1 • Dr. Amit Verma</p>
            <div class='mt-1.5'>
              <span class='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-[#DCFCE7] text-[#16A34A] border border-[#BBF7D0]'>3 Matches</span>
            </div>
          </div>
        </div>
        <svg class='w-5 h-5 text-[#17233C] stroke-[2.2]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='m9 18 6-6-6-6'/></svg>
      </div>
    </div>
  </main>

  <!-- Bottom Nav -->
  <nav class='fixed bottom-0 left-0 right-0 w-full bg-white/95 backdrop-blur-md border-t border-[#F4E3D8] shadow-xs z-40 pb-2 pt-1.5'>
    <div class='flex items-center justify-around px-2 max-w-lg mx-auto'>
      <div class='flex flex-col items-center'><svg class='w-5 h-5 text-[#6E7587]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/></svg><span class='text-[10px] text-[#6E7587]'>Home</span></div>
      <div class='flex flex-col items-center'><svg class='w-5 h-5 text-[#6E7587]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><circle cx='12' cy='12' r='10'/><path d='M12 8v8'/><path d='M8 12h8'/></svg><span class='text-[10px] text-[#6E7587]'>Post</span></div>
      <div class='flex flex-col items-center px-4 py-1.5 rounded-full bg-[#FEF08A] text-[#C2410C]'><svg class='w-5 h-5 text-[#EA580C]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/></svg><span class='text-[11px] font-black text-[#C2410C]'>Matches</span></div>
      <div class='flex flex-col items-center'><svg class='w-5 h-5 text-[#6E7587]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/></svg><span class='text-[10px] text-[#6E7587]'>Profile</span></div>
    </div>
  </nav>
</div>
`;

// 2. PAGE 2: Matched Students
const page2Content = `
<div class='min-h-screen bg-[#FFFDF9] text-[#17233C] flex flex-col justify-between pb-24'>
  <header class='flex items-center justify-between px-4 sm:px-6 py-3 bg-[#FFF8F3]/95 backdrop-blur-md sticky top-0 z-30 border-b border-[#F4E3D8]'>
    <div class='flex items-center gap-3'>
      <div class='p-1 -ml-1 text-[#17233C]'>
        <svg class='w-5 h-5 text-[#17233C] stroke-[2.4]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='m12 19-7-7 7-7'/><path d='M19 12H5'/></svg>
      </div>
      <h1 class='font-black text-[#17233C] text-lg sm:text-xl tracking-tight'>CSE2001 – Slot B1</h1>
    </div>
  </header>

  <main class='w-full max-w-xl mx-auto px-4 pt-4 space-y-4'>
    <!-- Top Course Info Card -->
    <div class='bg-white rounded-[24px] p-4 sm:p-5 border border-[#F4E3D8] shadow-xs space-y-3'>
      <div class='flex items-start gap-3'>
        <div class='w-12 h-12 rounded-2xl bg-[#FEF9C3] text-[#D97706] flex items-center justify-center shrink-0 border border-[#FEF08A]'>
          <svg class='w-6 h-6 stroke-[2]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z'/><path d='M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'/></svg>
        </div>
        <div class='min-w-0 flex-1'>
          <h2 class='font-black text-base sm:text-lg text-[#17233C] leading-tight'>CSE2001</h2>
          <p class='text-xs sm:text-sm text-[#6E7587] font-medium leading-tight mt-0.5 truncate'>Data Structures & Algorithms</p>
          <div class='mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FEF3C7] text-[#78350F] text-xs font-bold border border-[#FDE68A]'>
            <svg class='w-3.5 h-3.5' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/></svg>
            <span>Teacher: Dr. Rajesh Sharma</span>
          </div>
        </div>
      </div>
      <div class='flex items-center gap-2 pt-1 border-t border-[#F4E3D8]/60'>
        <div class='inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FEF3C7] text-[#D97706] text-xs font-black border border-[#FDE68A]'>
          <span>📅</span><span>Slot B1</span>
        </div>
        <div class='inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFFBEB] text-[#D97706] text-xs font-black border border-[#FEF3C7]'>
          <span>👤</span><span>Your Post</span>
        </div>
      </div>
    </div>

    <!-- Section Heading -->
    <div class='flex items-center gap-2 pt-1 px-1'>
      <span class='text-base'>👥</span>
      <h3 class='font-black text-sm sm:text-base text-[#17233C] tracking-tight'>Matched Students (5)</h3>
    </div>

    <!-- Matched Students List -->
    <div class='space-y-2.5'>
      <!-- Student 1 -->
      <div class='bg-white rounded-[22px] p-3.5 sm:p-4 border border-[#F4E3D8] shadow-2xs flex items-center justify-between gap-3'>
        <div class='flex items-center gap-3 min-w-0 flex-1'>
          <div class='w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-xs bg-[#FEF3C7] shrink-0'>
            <img src='https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop&crop=face' class='w-full h-full object-cover' />
          </div>
          <div class='min-w-0 flex-1'>
            <h4 class='font-black text-sm sm:text-base text-[#17233C] truncate'>Aarav Patel</h4>
            <p class='text-[11px] sm:text-xs text-[#6E7587] font-medium truncate mt-0.5'>B.Tech CSE • 3rd Year</p>
            <p class='text-[11px] sm:text-xs text-[#D97706] font-bold mt-0.5 flex items-center gap-1 truncate'>
              <span>🎓</span><span>Dr. Rajesh Sharma</span>
            </p>
          </div>
        </div>
        <div class='flex items-center gap-2 shrink-0'>
          <div class='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#16A34A] text-[11px] font-black border border-[#BBF7D0]'>
            <span>✓</span><span>Slot Match</span>
          </div>
          <div class='w-8 h-8 rounded-full bg-[#EDFAF3] text-[#16A34A] flex items-center justify-center shadow-2xs'>
            <img src='c:/Users/Shubham Narayan/Desktop/Idea/frontend/public/whatsapp.svg' class='w-5 h-5 object-contain' />
          </div>
        </div>
      </div>

      <!-- Student 2 -->
      <div class='bg-white rounded-[22px] p-3.5 sm:p-4 border border-[#F4E3D8] shadow-2xs flex items-center justify-between gap-3'>
        <div class='flex items-center gap-3 min-w-0 flex-1'>
          <div class='w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow-xs bg-[#FEF3C7] shrink-0'>
            <img src='https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face' class='w-full h-full object-cover' />
          </div>
          <div class='min-w-0 flex-1'>
            <h4 class='font-black text-sm sm:text-base text-[#17233C] truncate'>Priya Sharma</h4>
            <p class='text-[11px] sm:text-xs text-[#6E7587] font-medium truncate mt-0.5'>B.Tech CSE • 3rd Year</p>
            <p class='text-[11px] sm:text-xs text-[#D97706] font-bold mt-0.5 flex items-center gap-1 truncate'>
              <span>🎓</span><span>Dr. Rajesh Sharma</span>
            </p>
          </div>
        </div>
        <div class='flex items-center gap-2 shrink-0'>
          <div class='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#16A34A] text-[11px] font-black border border-[#BBF7D0]'>
            <span>✓</span><span>Slot Match</span>
          </div>
          <div class='w-8 h-8 rounded-full bg-[#EDFAF3] text-[#16A34A] flex items-center justify-center shadow-2xs'>
            <img src='c:/Users/Shubham Narayan/Desktop/Idea/frontend/public/whatsapp.svg' class='w-5 h-5 object-contain' />
          </div>
        </div>
      </div>
    </div>
  </main>
</div>
`;

// 3. PAGE 3: Match Details
const page3Content = `
<div class='min-h-screen bg-[#FFFDF9] text-[#17233C] flex flex-col justify-between pb-24'>
  <header class='flex items-center justify-between px-4 sm:px-6 py-3 bg-[#FFF8F3]/95 backdrop-blur-md sticky top-0 z-30 border-b border-[#F4E3D8]'>
    <div class='flex items-center gap-3'>
      <div class='p-1 -ml-1 text-[#17233C]'>
        <svg class='w-5 h-5 text-[#17233C] stroke-[2.4]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='m12 19-7-7 7-7'/><path d='M19 12H5'/></svg>
      </div>
      <h1 class='font-black text-[#17233C] text-lg sm:text-xl tracking-tight'>Match Details</h1>
    </div>
    <div class='p-1.5 text-[#17233C]'>
      <svg class='w-5 h-5 stroke-[2.2]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><circle cx='12' cy='12' r='1'/><circle cx='12' cy='5' r='1'/><circle cx='12' cy='19' r='1'/></svg>
    </div>
  </header>

  <main class='w-full max-w-xl mx-auto px-4 pt-4 space-y-4'>
    <!-- Profile Header Card -->
    <div class='relative w-full rounded-[26px] overflow-hidden bg-gradient-to-br from-[#FEF9C3] via-[#FEF08A]/60 to-[#FFFBEB] border border-[#FDE68A] p-4 sm:p-5 shadow-xs'>
      <div class='relative z-10 flex items-center gap-4'>
        <div class='relative shrink-0'>
          <div class='w-20 h-20 sm:w-22 sm:h-22 rounded-full border-3 border-white shadow-md overflow-hidden bg-white'>
            <img src='https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face' class='w-full h-full object-cover select-none' />
          </div>
          <div class='absolute -top-1 -right-1 text-[#F59E0B] font-bold text-sm'>✨</div>
          <div class='absolute bottom-0 right-1 w-4 h-4 rounded-full bg-[#22C55E] border-2 border-white shadow-xs'></div>
        </div>
        <div class='min-w-0 flex-1'>
          <div class='inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#DCFCE7] text-[#16A34A] text-xs font-black border border-[#BBF7D0] shadow-2xs'>
            <span>✓</span><span>Verified Student</span>
          </div>
          <h2 class='font-black text-xl sm:text-2xl text-[#17233C] tracking-tight leading-tight mt-1.5 truncate'>Priya Singh</h2>
          <p class='flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#6E7587] mt-1 truncate'>
            <svg class='w-4 h-4 text-[#6E7587] shrink-0' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/></svg>
            <span>Dr. Rajesh Sharma</span>
          </p>
        </div>
      </div>
    </div>

    <!-- Post & Course Details Card -->
    <div class='bg-white rounded-[26px] p-4 sm:p-5 border border-[#F4E3D8] shadow-xs space-y-3.5'>
      <div class='flex items-center gap-2 pb-2 border-b border-[#F4E3D8]/60'>
        <svg class='w-5 h-5 text-[#D97706] stroke-[2.2]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z'/><path d='M22 10v6'/><path d='M6 12.5V16a6 3 0 0 0 12 0v-3.5'/></svg>
        <h3 class='font-black text-sm sm:text-base text-[#17233C] tracking-tight'>Post & Course Details</h3>
      </div>

      <div class='flex items-center gap-3'>
        <div class='w-8 h-8 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0'>
          <svg class='w-4.5 h-4.5 stroke-[2.2]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z'/></svg>
        </div>
        <div class='flex items-center justify-between gap-2 flex-1 min-w-0'>
          <span class='text-xs text-[#6E7587] font-bold w-14 shrink-0'>Course</span>
          <span class='font-black text-xs sm:text-sm text-[#17233C] text-right truncate'>CSE2001 – Data Structures & Algorithms</span>
        </div>
      </div>

      <div class='flex items-center gap-3 pt-2 border-t border-[#F4E3D8]/60'>
        <div class='w-8 h-8 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0'>
          <svg class='w-4.5 h-4.5 stroke-[2.2]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><rect width='18' height='18' x='3' y='4' rx='2' ry='2'/><line x1='16' x2='16' y1='2' y2='6'/><line x1='8' x2='8' y1='2' y2='6'/><line x1='3' x2='21' y1='10' y2='10'/></svg>
        </div>
        <div class='flex items-center justify-between gap-2 flex-1 min-w-0'>
          <span class='text-xs text-[#6E7587] font-bold w-14 shrink-0'>Slot</span>
          <span class='font-black text-xs sm:text-sm text-[#78350F] bg-[#FEF08A] px-2.5 py-0.5 rounded-md'>B1</span>
        </div>
      </div>

      <div class='flex items-center gap-3 pt-2 border-t border-[#F4E3D8]/60'>
        <div class='w-8 h-8 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0'>
          <svg class='w-4.5 h-4.5 stroke-[2.2]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2'/><circle cx='12' cy='7' r='4'/></svg>
        </div>
        <div class='flex items-center justify-between gap-2 flex-1 min-w-0'>
          <span class='text-xs text-[#6E7587] font-bold w-14 shrink-0'>Teacher</span>
          <span class='font-black text-xs sm:text-sm text-[#17233C] text-right truncate'>Dr. Rajesh Sharma</span>
        </div>
      </div>

      <div class='space-y-1.5 pt-2 border-t border-[#F4E3D8]/60'>
        <div class='flex items-center gap-2'>
          <div class='w-8 h-8 rounded-xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center shrink-0'>
            <svg class='w-4.5 h-4.5 stroke-[2.2]' viewBox='0 0 24 24' fill='none' stroke='currentColor'><path d='M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z'/></svg>
          </div>
          <span class='text-xs text-[#6E7587] font-bold'>Post Note</span>
        </div>
        <div class='bg-[#FEFCE8] border border-[#FEF08A] rounded-2xl p-3 sm:p-3.5 text-xs sm:text-sm text-[#17233C] font-medium leading-relaxed'>
          Looking for classmates in the same slot to discuss, solve assignments and prepare for exams together.
        </div>
      </div>
    </div>
  </main>

  <!-- Sticky Bottom Button -->
  <footer class='fixed bottom-0 left-0 right-0 w-full bg-white/95 backdrop-blur-md border-t border-[#F4E3D8] p-3 z-40'>
    <div class='max-w-md mx-auto'>
      <button class='w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-[#FACC15] via-[#FBBF24] to-[#F59E0B] text-[#17233C] font-black text-sm sm:text-base shadow-md shadow-yellow-500/20 flex items-center justify-center gap-2.5'>
        <img src='c:/Users/Shubham Narayan/Desktop/Idea/frontend/public/whatsapp.svg' class='w-5 h-5 object-contain' />
        <span>Contact on WhatsApp</span>
      </button>
    </div>
  </footer>
</div>
`;

const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

fs.writeFileSync('c:/Users/Shubham Narayan/Desktop/Idea/frontend/preview_p1.html', generateHTML(page1Content));
execSync(`"${chromePath}" --headless --screenshot="C:/Users/Shubham Narayan/.gemini/antigravity/brain/c2e9315e-1520-410e-a8d5-204681060e3a/match_page1_preview.png" --window-size=390,750 "file:///c:/Users/Shubham Narayan/Desktop/Idea/frontend/preview_p1.html"`);
fs.unlinkSync('c:/Users/Shubham Narayan/Desktop/Idea/frontend/preview_p1.html');

fs.writeFileSync('c:/Users/Shubham Narayan/Desktop/Idea/frontend/preview_p2.html', generateHTML(page2Content));
execSync(`"${chromePath}" --headless --screenshot="C:/Users/Shubham Narayan/.gemini/antigravity/brain/c2e9315e-1520-410e-a8d5-204681060e3a/match_page2_preview.png" --window-size=390,750 "file:///c:/Users/Shubham Narayan/Desktop/Idea/frontend/preview_p2.html"`);
fs.unlinkSync('c:/Users/Shubham Narayan/Desktop/Idea/frontend/preview_p2.html');

fs.writeFileSync('c:/Users/Shubham Narayan/Desktop/Idea/frontend/preview_p3.html', generateHTML(page3Content));
execSync(`"${chromePath}" --headless --screenshot="C:/Users/Shubham Narayan/.gemini/antigravity/brain/c2e9315e-1520-410e-a8d5-204681060e3a/match_page3_preview.png" --window-size=390,750 "file:///c:/Users/Shubham Narayan/Desktop/Idea/frontend/preview_p3.html"`);
fs.unlinkSync('c:/Users/Shubham Narayan/Desktop/Idea/frontend/preview_p3.html');

console.log('All 3 preview screenshots generated successfully!');

