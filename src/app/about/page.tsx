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
        <p className="text-muted-foreground mb-6">Agathon is an AI-powered educational platform for students, teachers, and anyone who wants to learn.</p>

        <section className="prose">
          <p>Featuring an AI whiteboard, journals, and more tools to support learning and creativity.</p>
          <p>If you'd like to learn more or have any questions, reach out to us at support@agathon.app</p>
        </section>
      </div>
    </main>
  );
}
