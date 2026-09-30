import { BackLink } from "@/components/shared/back-link";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  /** Alt sayfalarda bir üst sayfaya dönüş bağlantısı */
  back?: { href: string; label: string };
}

export const PageHeader = ({ title, description, actions, back }: PageHeaderProps) => {
  return (
    <div className="mb-6 space-y-2">
      {back && <BackLink href={back.href} label={back.label} />}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
};
