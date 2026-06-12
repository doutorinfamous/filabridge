import { DatabaseBrowser } from "@/components/_temp/database-browser";

export default function DevDatabasePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Database</h1>
        <p className="text-sm text-muted-foreground">
          Read-only inspection of the local SQLite database (filabridge.db),
          with schema and data updated in real time
        </p>
      </header>
      <DatabaseBrowser />
    </div>
  );
}
