import React from 'react';

const leadFeature = {
  tag: 'MOBILE',
  name: 'Draw a play on your phone',
  description:
    'No install, no laptop required — sketch routes on a real field from the sideline or the couch, in about two minutes.',
};

const supportingFeatures = [
  {
    tag: 'PRINT',
    name: 'Game-day printing',
    description: 'Export a single play or a full playbook as a clean PDF, or print wristbands your players can read at the line.',
  },
  {
    tag: 'LIBRARY',
    name: 'Browse the community library',
    description: 'Look through plays other coaches have published, filtered by format and formation, and copy any of them straight into your own plays.',
  },
  {
    tag: 'ORGANIZE',
    name: 'Playbooks by situation',
    description: 'Group plays into playbooks — red zone, two-minute, your base offense — so the right play is easy to find on Saturday morning.',
  },
];

export function Features() {
  return (
    <div className="py-16 bg-board-light border-t border-chalk/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="font-label text-sm text-primary font-semibold tracking-widest uppercase">Features</h2>
        <p className="mt-2 max-w-2xl font-display text-3xl leading-8 tracking-tight text-chalk sm:text-4xl">
          Built for the volunteer coach
        </p>

        {/* Lead feature — larger, on its own, standing in for the section's
            one-sentence thesis instead of a same-sized tile among four. */}
        <div className="mt-10 max-w-3xl border-t border-chalk/10 pt-8">
          <p className="font-label text-xs tracking-widest text-primary/80">{leadFeature.tag}</p>
          <p className="mt-2 font-display text-2xl sm:text-3xl text-chalk">{leadFeature.name}</p>
          <p className="mt-3 font-editorial text-lg text-chalk/70 max-w-xl">{leadFeature.description}</p>
        </div>

        {/* Supporting features — a quieter list, not a peer grid — separated
            by rules rather than card borders so nothing is boxed in. */}
        <div className="mt-10 grid gap-x-10 gap-y-8 border-t border-chalk/10 pt-8 sm:grid-cols-3">
          {supportingFeatures.map((feature) => (
            <div key={feature.name} className="sm:border-l sm:border-chalk/10 sm:pl-6 first:sm:border-l-0 first:sm:pl-0">
              <p className="font-label text-xs tracking-widest text-primary/80">{feature.tag}</p>
              <p className="mt-1.5 text-base font-bold text-chalk">{feature.name}</p>
              <p className="mt-2 font-editorial text-sm text-chalk/70">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}