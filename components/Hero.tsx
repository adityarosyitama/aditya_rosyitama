'use client';
import { motion } from 'framer-motion';
import { profile } from '@/lib/data';
import { Github, Linkedin } from 'lucide-react';

export default function Hero() {
  return (
    <section className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black">
      {/* Background Gradient - Optimized untuk Next.js 15 */}
      <div className="absolute inset-0 bg-linear-to-br from-violet-900/20 via-purple-900/30 to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.3),transparent_70%)]" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center">
        {/* <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="mb-8"
        >
          <span className="inline-block px-6 py-2 text-sm font-medium tracking-wider text-purple-300 bg-purple-900/30 backdrop-blur-md rounded-full border border-purple-500/30">
            Available for freelance & full-time roles
          </span>
        </motion.div> */}

        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 1 }}
          className="text-5xl md:text-7xl lg:text-8xl font-black text-purple-300  text-gradient "
        >
          {profile.name}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-2xl md:text-4xl mt-6 font-light text-gray-300"
        >
          {profile.title}
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="mt-6 text-xl text-purple-300 font-medium"
        >
          {profile.tagline}
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.4 }}
          className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto"
        >
          {profile.location}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.7 }}
          className="mt-12 flex gap-6 justify-center"
        >
          <a href={profile.github} target="_blank" rel="noopener noreferrer" className="p-4 bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl hover:bg-white/20 hover:scale-110 transition-all duration-300">
            <Github className="w-8 h-8" />
          </a>
          <a href={profile.linkedin} target="_blank" rel="noopener noreferrer" className="p-4 bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl hover:bg-white/20 hover:scale-110 transition-all duration-300">
            <Linkedin className="w-8 h-8" />
          </a>
          {/* <a href={`mailto:${profile.email}`} className="px-8 py-4 bg-linear-to-r from-purple-600 to-pink-600 rounded-2xl font-bold hover:scale-105 transition-all duration-300 shadow-2xl">
            Hire Me
          </a> */}
        </motion.div>
      </div>
    </section>
  );
}