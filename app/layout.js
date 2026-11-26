import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import Navbar from "@/components/Navbar";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata = {
  title: "AuraNails | Agenda tu cita",
  description: "Encuentra tu manicurista ideal y reserva tu próxima cita.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${playfair.variable} ${jakarta.variable}`}>
      <body>
        <Navbar />
        <main className="min-h-[calc(100vh-76px)]">{children}</main>
      </body>
    </html>
  );
}
