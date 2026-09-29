import { ProductionTabs } from "./components/production-tabs";

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      <ProductionTabs />
      {children}
    </div>
  );
}
