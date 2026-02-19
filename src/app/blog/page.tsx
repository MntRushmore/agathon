import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Blog',
  description: 'Agathon — Blog',
};

export default function BlogPage() {
  return (
    <main className="container mx-auto py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-4">Blog</h1>
        <p className="text-muted-foreground mb-6">Welcome to the Agathon blog. Posts will appear here.</p>

        <section className="space-y-6">
          <article className="p-4 border rounded-lg">
            <h2 className="text-xl font-semibold">No posts yet</h2>
            <p className="text-sm text-muted-foreground">Check back soon.</p>
            <div className="mt-3">
              <Link href="/about" className="text-primary hover:underline">About Agathon</Link>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
