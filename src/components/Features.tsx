import React from 'react';
import { Smartphone, Printer, Library, BookOpen } from 'lucide-react';

const features = [
  {
    tag: 'MOBILE',
    name: 'Draw a play on your phone',
    description: 'No install, no laptop required — sketch routes on a real field from the sideline or the couch, in about two minutes.',
    icon: Smartphone,
  },
  {
    tag: 'PRINT',
    name: 'Game-day printing',
    description: 'Export a single play or a full playbook as a clean PDF, or print wristbands your players can read at the line.',
    icon: Printer,
  },
  {
    tag: 'LIBRARY',
    name: 'Browse the community library',
    description: 'Look through plays other coaches have published, filtered by format and formation, and copy any of them straight into your own plays.',
    icon: Library,
  },
  {
    tag: 'ORGANIZE',
    name: 'Playbooks by situation',
    description: 'Group plays into playbooks — red zone, two-minute, your base offense — so the right play is easy to find on Saturday morning.',
    icon: BookOpen,
  },
];

export function Features() {
  return (
    <div className="py-12 bg-board-light border-t border-chalk/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:text-center">
          <h2 className="font-label text-sm text-primary font-semibold tracking-widest uppercase">Features</h2>
          <p className="mt-2 font-display text-3xl leading-8 tracking-tight text-chalk sm:text-4xl">
            Built for the volunteer coach
          </p>
          <p className="mt-4 max-w-2xl text-xl text-chalk/70 lg:mx-auto">
            No coaching background required — just a field, a roster, and two minutes to draw the play.
          </p>
        </div>

        <div className="mt-10">
          <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
            {features.map((feature) => (
              <div key={feature.name} className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary text-white">
                  <feature.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="ml-16 font-label text-xs tracking-widest text-primary/80">{feature.tag}</p>
                <p className="ml-16 text-lg leading-6 font-bold text-chalk">{feature.name}</p>
                <p className="mt-2 ml-16 text-base text-chalk/70">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}