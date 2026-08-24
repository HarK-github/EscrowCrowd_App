import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const QUOTE_ICON = "https://cdn-icons-png.flaticon.com/512/2997/2997300.png";

export function Testimonial() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end center"]
  });

  const text = "EscrowCrowd brings absolute trust to crowdfunding. If a project fails to meet its goal by the deadline, your funds are completely safe. This smart contract driven escrow completely changes the game for backers.";
  const words = text.split(" ");

  return (
    <section className="min-h-screen py-24 md:py-32 px-8 md:px-28 flex items-center justify-center bg-background relative z-10">
      <div ref={containerRef} className="max-w-3xl mx-auto flex flex-col items-start gap-10">
        <img src={QUOTE_ICON} alt="Quote" className="w-14 h-10 object-contain opacity-80 invert" />

        <div className="text-3xl md:text-5xl font-medium leading-[1.3] flex flex-wrap text-center md:text-left justify-center md:justify-start">
          {words.map((word, i) => {
            const start = i / words.length;
            const end = (i + 1) / words.length;
            const opacity = useTransform(scrollYProgress, [start, end], [0.3, 1]);
            const color = useTransform(scrollYProgress, [start, end], ["hsl(0 0% 50%)", "hsl(0 0% 100%)"]);

            return (
              <motion.span key={i} style={{ opacity, color }} className="mr-[0.3em] transition-colors duration-100">
                {word}
              </motion.span>
            );
          })}
          <span className="text-muted-foreground ml-2">"</span>
        </div>
      </div>
    </section>
  );
}
