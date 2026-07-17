import React from 'react';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    name: "Coach Mike Thompson",
    role: "Head Coach, Eagles Youth Football",
    image: "https://images.unsplash.com/photo-1556157382-97eda2d62296?ixlib=rb-1.2.1&auto=format&fit=crop&q=80",
    quote: "Playbuilder Pro has transformed how we teach plays to our young athletes. The visual tools are incredible!",
    rating: 5
  },
  {
    name: "Sarah Martinez",
    role: "Assistant Coach, Warriors",
    image: "https://images.unsplash.com/photo-1548142813-c348350df52b?ixlib=rb-1.2.1&auto=format&fit=crop&q=80",
    quote: "The play generator has helped us create unique strategies that work perfectly for our team's skill level.",
    rating: 5
  },
  {
    name: "David Chen",
    role: "Youth Program Director",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-1.2.1&auto=format&fit=crop&q=80",
    quote: "An invaluable resource for any youth football program. Worth every penny!",
    rating: 5
  }
];

export function Testimonials() {
  return (
    <div className="py-16 bg-board-light border-t border-chalk/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-chalk font-bold text-chalk">
            Trusted by Coaches Nationwide
          </h2>
          <p className="mt-4 text-lg text-chalk/70">
            See what our community has to say about Playbook Pro
          </p>
        </div>
        
        <div className="mt-12 grid gap-8 lg:grid-cols-3 lg:gap-x-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="relative bg-board p-8 rounded-2xl shadow-lg border border-chalk/10"
            >
              <div className="absolute -top-4 -right-4">
                <Quote className="w-8 h-8 text-primary opacity-50" />
              </div>
              
              <div className="relative">
                <div className="flex items-center mb-6">
                  <img
                    className="h-12 w-12 rounded-full object-cover"
                    src={testimonial.image}
                    alt={testimonial.name}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="ml-4">
                    <div className="text-base font-semibold text-chalk">{testimonial.name}</div>
                    <div className="text-sm text-chalk/70">{testimonial.role}</div>
                  </div>
                </div>
                
                <div className="flex mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star
                      key={i}
                      className="h-5 w-5 text-primary"
                      fill="currentColor"
                    />
                  ))}
                </div>
                
                <blockquote>
                  <p className="text-base text-chalk/90 italic">"{testimonial.quote}"</p>
                </blockquote>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}