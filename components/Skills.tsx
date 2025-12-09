'use client';
import { profile } from '@/lib/data';
import { motion } from 'framer-motion';
import { FadeInWhenVisible } from './motion';

export default function Skills() {
  return (
    <section className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black">
      {/* Background Gradient - Optimized untuk Next.js 15 */}
      <div className="absolute inset-0 bg-linear-to-br from-violet-900/20 via-purple-900/30 to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.3),transparent_70%)]" />
      <div className="max-w-6xl mx-auto">
        <FadeInWhenVisible>
          <h2 className="text-5xl md:text-6xl font-bold text-center mb-20 text-gradient ">
            Tech Stack
          </h2>
        </FadeInWhenVisible>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {profile.skills.map((skill, i) => (
            <motion.div
              key={skill}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.15, rotate: 5 }}
              transition={{ delay: i * 0.05 }}
              viewport={{ once: true }}
              className="p-6 bg-linear-to-br from-purple-600/30 to-blue-600/30 backdrop-blur-md border border-white/20 rounded-2xl text-center font-semibold text-lg hover:from-purple-500/50 hover:to-blue-500/50 transition-all duration-300"
            >
              {skill}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}