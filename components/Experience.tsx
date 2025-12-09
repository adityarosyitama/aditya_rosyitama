'use client';
import { profile } from '@/lib/data';
import { motion } from 'framer-motion';
import { FadeInWhenVisible, StaggerContainer, StaggerItem } from './motion';

export default function Experience() {
  return (
    <section className="min-h-screen flex items-center justify-center relative overflow-hidden bg-black">
      {/* Background Gradient - Optimized untuk Next.js 15 */}
      <div className="absolute inset-0 bg-linear-to-br from-violet-900/20 via-purple-900/30 to-black" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(120,119,198,0.3),transparent_70%)]" />
      <div className="max-w-5xl mx-auto">
        <FadeInWhenVisible>
          <h2 className="text-center text-5xl md:text-6xl font-bold mb-20 text-gradient ">
            Experience
          </h2>
        </FadeInWhenVisible>

        <StaggerContainer>
          {profile.experience.map((job, i) => (
            <StaggerItem key={i}>
              <motion.div
                className="group mb-10 p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl hover:bg-white/10 hover:border-white/30 transition-all duration-500"
                whileHover={{ y: -5 }}
              >
                <div className="flex flex-col md:flex-row md:justify-between items-start">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-bold group-hover:text-cyan-400 transition">
                      {job.role}
                    </h3>
                    <p className="text-xl text-purple-400 mt-2">{job.company}</p>
                  </div>
                  <span className="text-gray-400 mt-4 md:mt-0 text-lg">{job.period}</span>
                </div>
                <p className="mt-6 text-gray-300 text-lg">{job.desc}</p>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>
    </section>
  );
}