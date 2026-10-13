import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "Vedic Astrology",
  description: "A grounded, evidence-led Vedic astrology application.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
