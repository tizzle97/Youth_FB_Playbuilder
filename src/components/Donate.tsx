import React from 'react';
import { Heart, Coffee, Trophy, Star } from 'lucide-react';

const tiers = [
  {
    name: "Supporter",
    icon: Coffee,
    price: "1",
    description: "Every dollar helps",
    features: [
      "Name on supporters page",
      "Supporter badge",
      "Good karma"
    ]
  },
  {
    name: "MVP",
    icon: Trophy,
    price: "5",
    description: "Help us grow",
    features: [
      "All Supporter benefits",
      "Early access to new features",
      "Priority support"
    ],
    popular: true
  },
  {
    name: "All-Star",
    icon: Star,
    price: "10",
    description: "Make a bigger impact",
    features: [
      "All MVP benefits",
      "Custom play consultation",
      "Featured coach profile"
    ]
  }
];

export function Donate() {
  return (
    <div className="py-16 bg-board-light border-t border-chalk/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <Heart className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-3xl font-chalk font-bold text-chalk">
            Support Our Mission
          </h2>
          <p className="mt-4 text-lg text-chalk/70 max-w-2xl mx-auto">
            Help us continue providing quality resources to youth football coaches and players.
            Your support keeps Playbuilder Pro free for those who need it most.
          </p>
        </div>

        <div className="mt-12 grid gap-8 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative bg-board rounded-2xl shadow-xl border ${
                tier.popular ? 'border-primary' : 'border-chalk/10'
              }`}
            >
              {tier.popular && (
                <div className="absolute -top-4 inset-x-0">
                  <div className="inline-block bg-primary px-4 py-1 rounded-full text-sm font-semibold text-white">
                    Most Popular
                  </div>
                </div>
              )}

              <div className="p-8">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-chalk">{tier.name}</h3>
                  <tier.icon className="h-6 w-6 text-primary" />
                </div>
                
                <div className="mt-4 flex items-baseline text-chalk">
                  <span className="text-4xl font-bold tracking-tight">${tier.price}</span>
                  <span className="ml-2 text-chalk/70">one-time donation</span>
                </div>
                
                <p className="mt-6 text-chalk/70">{tier.description}</p>

                <ul className="mt-6 space-y-4">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex text-chalk/90">
                      <span className="flex-shrink-0">
                        <svg className="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                      <span className="ml-3">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button className={`mt-8 w-full rounded-lg px-4 py-2 text-center font-medium ${
                  tier.popular
                    ? 'bg-primary hover:bg-primary-dark text-white'
                    : 'bg-board-light hover:bg-board border border-chalk/20 text-chalk'
                } transition-colors duration-200`}>
                  Donate ${tier.price}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-chalk/70">
            All donations are secure and encrypted. By contributing, you agree to our terms of service.
          </p>
        </div>
      </div>
    </div>
  );
}