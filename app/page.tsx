import Hero from '@/components/Hero';
import About from '@/components/About';
import TopSkills from '@/components/TopSkills';
import Experience from '@/components/Experience';
import Skills from '@/components/Skills';

export default function Home() {
  return (
    <main className="min-h-screen bg-black antialiased">
      <Hero />
      <About />
      <TopSkills />
      <Experience />
      <Skills />
    </main>
  );
}