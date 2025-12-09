'use client';
import { profile } from '@/lib/data';
import { motion } from 'framer-motion';

export default function TopSkills() {
  return (
    <section className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black">
      {/* Background Gradient - Optimized untuk Next.js 15 */}
      <div className="absolute inset-0 bg-linear-to-br from-violet-900/20 via-purple-900/30 to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.3),transparent_70%)]" />
      <div className="max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-4xl md:text-5xl font-bold mb-16 text-gradient "
        >
          Top Skills
        </motion.h2>

        <div className="flex flex-wrap justify-center gap-4">
          {profile.topSkills.map((skill, i) => (
            <motion.span
              key={skill}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ scale: 1.15, rotate: 5 }}
              viewport={{ once: true }}
              className="px-6 py-3 bg-linear-to-r from-purple-600/40 to-pink-600/40 backdrop-blur-md border border-white/20 rounded-full text-lg font-medium hover:from-purple-500 hover:to-pink-500 transition-all duration-300"
            >
              {skill}
            </motion.span>
          ))}
        </div>
      </div>
    </section>
  );
}