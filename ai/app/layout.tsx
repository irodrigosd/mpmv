import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'MPMV AI', description: 'Seu assistente de IA' };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="pt-BR"><body>{children}</body></html>; }
