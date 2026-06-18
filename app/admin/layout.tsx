import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ONMATOUT 어드민",
  description: "ONMATOUT BO",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-ink antialiased">
      {children}
    </div>
  );
}
