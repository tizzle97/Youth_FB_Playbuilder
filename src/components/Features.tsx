import React from 'react';
import { PlayCircle, Users, BookOpen, Layout } from 'lucide-react';

const features = [
  {
    name: 'Extensive Play Database',
    description: 'Access hundreds of 5v5 and 7v7 plays, complete with detailed diagrams and instructions.',
    icon: PlayCircle,
  },
  {
    name: 'Interactive Play Designer',
    description: 'Create and customize your own plays with our intuitive drag-and-drop interface.',
    icon: Layout,
  },
  {
    name: 'Community Forum',
    description: 'Connect with other coaches, share strategies, and learn from experienced mentors.',
    icon: Users,
  },
  {
    name: 'Expert Blog',
    description: 'Stay updated with insights, strategies, and expert advice from seasoned youth football coaches.',
    icon: BookOpen,
  },
];

export function Features() {
  return (
    <div className="py-12 bg-board-light border-t border-chalk/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:text-center">
          <h2 className="text-base text-primary font-chalk font-semibold tracking-wide uppercase">Features</h2>
          <p className="mt-2 text-3xl leading-8 font-chalk font-bold tracking-tight text-chalk sm:text-4xl">
            Everything you need to succeed
          </p>
          <p className="mt-4 max-w-2xl text-xl text-chalk/70 lg:mx-auto font-chalk">
            Comprehensive tools and resources designed specifically for youth football coaches and players.
          </p>
        </div>

        <div className="mt-10">
          <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
            {features.map((feature) => (
              <div key={feature.name} className="relative">
                <div className="absolute flex items-center justify-center h-12 w-12 rounded-md bg-primary text-white">
                  <feature.icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <p className="ml-16 text-lg leading-6 font-chalk font-bold text-chalk">{feature.name}</p>
                <p className="mt-2 ml-16 text-base text-chalk/70 font-chalk">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}