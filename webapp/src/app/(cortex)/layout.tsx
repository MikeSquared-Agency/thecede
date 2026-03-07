import { CortexHeader } from "@/components/layout/cortex-header";
import { Terminal } from "@/components/terminal/Terminal";

export default function CortexLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col bg-background">
      <CortexHeader />
      <main className="flex flex-1 overflow-hidden">{children}</main>
      <Terminal className="h-48 shrink-0" />
    </div>
  );
}
