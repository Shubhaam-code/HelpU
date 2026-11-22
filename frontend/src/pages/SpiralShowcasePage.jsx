import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, MoveVertical, Hand, MousePointer, Eye } from 'lucide-react';
import InfiniteSpiral from '../components/ui/InfiniteSpiral';
import { spiralImages } from '../components/ui/spiralImages';

export default function SpiralShowcasePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[#FFFDF9] text-[#17233C] flex flex-col justify-between selection:bg-[#F59E0B]/20 selection:text-[#D97706]">
      {/* Top Bar */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-[#F4E3D8] px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="p-2 rounded-full hover:bg-[#FFF5ED] text-[#17233C] border border-[#F4E3D8] transition-all cursor-pointer active:scale-95"
            aria-label="Back to Landing Page"
          >
            <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="HelpU" className="h-7 w-auto" />
            <span className="text-xs font-black px-2 py-0.5 rounded-full bg-[#FFF5ED] text-[#FF572E] border border-[#FFE4D6]">
              3D Infinite Spiral
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/slotmate')}
          className="px-4 py-1.5 rounded-full text-xs font-black text-white bg-gradient-to-r from-[#FF6B35] to-[#FF451A] hover:from-[#FF572E] hover:to-[#E63E15] shadow-xs active:scale-95 transition-all cursor-pointer"
        >
          Enter App
        </button>
      </header>

      {/* Main Spiral Stage */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 max-w-4xl mx-auto w-full">
        <div className="text-center max-w-lg mb-4 space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFF5ED] text-[#FF572E] text-xs font-black border border-[#FFE4D6]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Interactive React Bits 3D Gallery</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#17233C] tracking-tight">
            HelpU Feature Showcase
          </h1>
          <p className="text-xs sm:text-sm text-[#6E7587]">
            Continuous looping 3D spiral showcasing all 12 HelpU app screens in their exact sequence.
          </p>
        </div>

        {/* 3D Spiral Container */}
        <div className="relative w-full h-[450px] sm:h-[520px] rounded-3xl bg-gradient-to-b from-[#FFFDF9] via-[#FFF9F5] to-white border border-[#F4E3D8] shadow-sm overflow-hidden flex items-center justify-center">
          <InfiniteSpiral
            items={spiralImages}
            animationMode="all"
            speed={0.55}
            radius={170}
            cardWidth={100}
            cardHeight={100}
            verticalSpacing={60}
            perspective={1000}
            cardRadius={10}
            centerScale={1.2}
            edgeBlur={6}
            cardsPerTurn={7}
            pauseOnHover
          />
        </div>

        {/* Interaction hints */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-4 text-[11px] sm:text-xs font-semibold text-[#6E7587]">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#F4E3D8]">
            <Hand className="w-3 h-3 text-[#FF572E]" /> Drag to spin
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#F4E3D8]">
            <MoveVertical className="w-3 h-3 text-[#F59E0B]" /> Scroll to advance
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#F4E3D8]">
            <MousePointer className="w-3 h-3 text-[#2563EB]" /> Hover to pause
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-[#F4E3D8]">
            <Eye className="w-3 h-3 text-[#16A34A]" /> 12 unique app screens
          </span>
        </div>
      </main>

      {/* Footer / Screen Index */}
      <footer className="border-t border-[#F4E3D8] bg-white/60 py-4 px-4 text-center text-xs text-[#8A92A6]">
        Showing 12 screenshots in exact sequence: SlotMate (1-4) &bull; PoolMate (5-8) &bull; FFCS Mate (9-12)
      </footer>
    </div>
  );
}