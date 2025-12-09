import { profile } from '@/lib/data';
import { FadeInWhenVisible } from './motion'; // Import dari motion.tsx (buat file ini nanti)

export default function About() {
  return (
    <section className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black">
      {/* Background Gradient - Optimized untuk Next.js 15 */}
      <div className="absolute inset-0 bg-linear-to-br from-violet-900/20 via-purple-900/30 to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.3),transparent_70%)]" />
      <div className="max-w-4xl mx-auto">
        <FadeInWhenVisible>
          <h2 className="text-5xl md:text-6xl font-bold text-center mb-16 text-gradient ">
            About Me
          </h2>
          <p className="text-xl text-gray-300 text-center leading-relaxed max-w-3xl mx-auto mt-10">
            {profile.about}
          </p>
        </FadeInWhenVisible>
      </div>
    </section>
  );
}