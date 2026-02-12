import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Billing | Agathon',
  description: 'Agathon is an AI Socratic Whiteboard - Learn By Doing',
};

export default function BillingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
