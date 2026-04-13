import Image from 'next/image';

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div style={{ background: 'linear-gradient(180deg, #ffffff 0%, #ffffff 55%, #aaaaaa 75%, #333333 88%, #0a0a0a 100%)' }} className="absolute inset-x-0 top-0 px-4 pb-10 pt-4 text-center">
        <Image src="/logos/csp-logo-transparent.png" alt="Closer Simulator Pro" width={130} height={130} className="mx-auto" priority />
      </div>

      <div className="mt-32">
        <h1 className="text-[28px] font-black uppercase tracking-wider text-white">
          The Arena Is <span className="text-[#FF1B1B]">Coming</span>
        </h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-[#888]">
          Closer Simulator Pro is the AI-powered roleplay training tool that turns
          good agents into closers. Practice FSBO, Expired, Cold Calling, and more
          against ruthlessly realistic prospects.
        </p>
        <div className="mx-auto mt-6 h-[2px] w-12 bg-[#FF1B1B]" />
        <p className="mt-6 text-[13px] text-[#555]">
          Want access? Contact your coach or training program for your VIP link.
        </p>
      </div>
    </main>
  );
}
