import { CortexHeader } from "@/components/layout/cortex-header";
import { Terminal } from "@/components/terminal/Terminal";
import { WebMCPProvider } from "@/components/webmcp-provider";

export default function CortexLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WebMCPProvider>
      <div className="flex h-screen flex-col bg-background">
        <CortexHeader />
        <main className="flex flex-1 overflow-hidden">{children}</main>
        <Terminal className="h-48 shrink-0" />
      </div>
    </WebMCPProvider>
  );
}
