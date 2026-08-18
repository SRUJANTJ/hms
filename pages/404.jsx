export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-[radial-gradient(circle_at_50%_20%,#1c2333_0%,#10131c_60%,#0b0d13_100%)] text-[#e9e6df] font-sans">
      <div className="relative w-[220px] h-[260px] mb-9">
        <div className="nf-door absolute inset-0 rounded-t-[10px] rounded-b-[6px] bg-gradient-to-br from-[#2b3346] to-[#1a2130] border-2 border-[#3a4358] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6),inset_0_0_0_6px_#10131c] origin-left">
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="text-[52px] font-extrabold tracking-wider text-[#C9A24B] [text-shadow:0_0_24px_rgba(201,162,75,0.45)]">
              404
            </div>
            <div className="absolute right-[18px] top-1/2 w-3.5 h-3.5 rounded-full bg-[#C9A24B] shadow-[0_0_10px_rgba(201,162,75,0.7)]" />
          </div>
          <div className="nf-glow absolute -inset-5 rounded-2xl bg-[radial-gradient(circle,rgba(201,162,75,0.15),transparent_70%)] pointer-events-none" />
        </div>

        <div className="nf-key absolute -top-[18px] right-[26px] origin-top">
          <svg viewBox="0 0 64 24" width="64" height="24">
            <circle cx="12" cy="12" r="9" fill="none" stroke="#C9A24B" strokeWidth="3" />
            <rect x="20" y="9.5" width="34" height="5" fill="#C9A24B" />
            <rect x="46" y="14.5" width="5" height="7" fill="#C9A24B" />
            <rect x="54" y="14.5" width="5" height="9" fill="#C9A24B" />
          </svg>
        </div>
      </div>

      <h1 className="text-xl font-bold mb-2 text-[#f2efe8]">
        This room isn&apos;t on the floor plan.
      </h1>
      <p className="text-sm text-[#a9a6a0] max-w-[380px] leading-relaxed mb-7">
        Room <span className="text-[#C9A24B] font-bold">404</span> doesn&apos;t exist &mdash;
        check the room number, or head back to the block you know.
      </p>

      <a
        href="/"
        className="inline-block px-6 py-3 rounded-lg bg-[#C9A24B] text-[#10131c] font-bold text-sm no-underline shadow-[0_8px_20px_-6px_rgba(201,162,75,0.5)] transition-transform hover:-translate-y-0.5 hover:shadow-[0_12px_26px_-6px_rgba(201,162,75,0.65)]"
      >
        Back to Dashboard
      </a>

      <style jsx>{`
        .nf-door {
          animation: nf-creak 4s ease-in-out infinite;
        }
        .nf-key {
          animation: nf-swing 2.6s ease-in-out infinite;
        }
        .nf-glow {
          animation: nf-pulse 3s ease-in-out infinite;
        }
        @keyframes nf-creak {
          0%, 100% { transform: perspective(600px) rotateY(0deg); }
          50% { transform: perspective(600px) rotateY(-8deg); }
        }
        @keyframes nf-swing {
          0%, 100% { transform: rotate(-12deg); }
          50% { transform: rotate(12deg); }
        }
        @keyframes nf-pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .nf-door, .nf-key, .nf-glow {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}