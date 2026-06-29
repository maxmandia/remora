export function SettingsLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full min-h-full px-26 py-10">
      <h2 className="text-secondary-foreground text-3xl font-light">{title}</h2>
      <p className="text-muted-foreground text-base font-light">
        {description}
      </p>
      <div className="py-10">{children}</div>
    </div>
  );
}
