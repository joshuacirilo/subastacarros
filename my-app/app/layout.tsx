import type { Metadata } from "next";
import { SessionProvider, Header } from "@/components/session";
import "./globals.css";
export const metadata: Metadata = {
  title: "SubastaGT | Subastas de vehículos",
  description:
    "Encuentra tu próximo vehículo. Subastas transparentes, ofertas privadas y oportunidades en Guatemala.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>
        <SessionProvider>
          <Header />
          {children}
          <footer className="site-footer">
            <span className="brand">
              Subasta<span className="brand-accent">GT</span>
            </span>
            <p>Tu próxima oportunidad, a una oferta de distancia.</p>
            <span>Guatemala · Montos en quetzales · UTC−6</span>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
