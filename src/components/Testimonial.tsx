import React from 'react';

const QUOTE_ICON = "https://cdn-icons-png.flaticon.com/512/2997/2997300.png";

export function Testimonial() {
  return (
    <section className="min-h-screen py-24 md:py-32 px-8 md:px-28 flex items-center justify-center bg-background relative z-10">
      <div className="max-w-3xl mx-auto flex flex-col items-start gap-10">
        <img src={QUOTE_ICON} alt="Quote" className="w-14 h-10 object-contain opacity-80 invert" />
        <blockquote className="text-3xl md:text-5xl font-medium leading-[1.3] text-foreground text-center md:text-left">
          &ldquo;EscrowCrowd brings absolute trust to crowdfunding. If a project fails to meet its goal by the deadline, your funds are completely safe. This smart contract driven escrow completely changes the game for backers.&rdquo;
        </blockquote>
      </div>
    </section>
  );
}
