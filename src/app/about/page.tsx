import React from 'react';
import Image from 'next/image';

export const metadata = {
  title: 'About',
  description: 'About Agathon',
};

export default function AboutPage() {
  return (
    <main className="container mx-auto py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">About Agathon</h1>
        <p className="text-muted-foreground mb-6">Agathon is an educational platform focused on math and learning.</p>

        <section className="prose">
          <p>Our mission is to make math more engaging and accessible for students and teachers.</p>
          <p>If you'd like to learn more, reach out via the contact form or join our community.</p>
        </section>
      </div>
    </main>
  );
}
