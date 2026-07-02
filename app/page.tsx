import Link from 'next/link';
import CubeIcon from '@/components/CubeIcon';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#F5EFE6] flex flex-col items-center justify-center px-6">
      <div className="flex items-center gap-3 mb-3">
        <CubeIcon size={40} />
        <h1 className="text-4xl font-bold text-[#2C1A0E] tracking-tight">
          AI Diffusion Cube
        </h1>
      </div>
      <p className="text-[#7A5C44] text-lg mb-12 text-center max-w-md">
        Explore, map and design AI deployments across six dimensions
      </p>

      <div className="flex flex-col sm:flex-row gap-6 w-full max-w-2xl">
        <Link
          href="/explore"
          className="flex-1 bg-[#2C1A0E] hover:bg-[#3a2414] border border-[#7A5C44]/30 rounded-2xl p-8 text-white transition-colors group"
        >
          <div className="text-3xl mb-3">🔍</div>
          <h2 className="text-xl font-semibold mb-2">Explore existing deployments</h2>
          <p className="text-[#C4A882] text-sm leading-relaxed">
            Explore pathways from real AI deployments - not just what they did, but what you can learn from them.
          </p>
          <div className="mt-6 text-[#E8A838] text-sm font-medium group-hover:text-amber-300">
            Browse pathways →
          </div>
        </Link>

        <Link
          href="/design"
          className="flex-1 bg-[#2C1A0E] hover:bg-[#3a2414] border border-[#7A5C44]/30 rounded-2xl p-8 text-white transition-colors group"
        >
          <div className="text-3xl mb-3">🧩</div>
          <h2 className="text-xl font-semibold mb-2">Design your deployment</h2>
          <p className="text-[#C4A882] text-sm leading-relaxed">
            Design your AI deployment guided by lived experience from real deployments.
          </p>
          <div className="mt-6 text-[#E8A838] text-sm font-medium group-hover:text-amber-300">
            Start designing →
          </div>
        </Link>
      </div>
    </main>
  );
}
