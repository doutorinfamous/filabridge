"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AutoAssignSettings,
  TimeoutSettings,
} from "@/components/settings/advanced-settings";
import {
  HomeAssistantSettings,
  SpoolmanSettings,
} from "@/components/settings/general-settings";
import { PrintersSettings } from "@/components/settings/printers-settings";

function SettingsContent() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "general";
  const [tab, setTab] = React.useState(initialTab);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Spoolman, Home Assistant, printers, and FilaBridge behavior
        </p>
      </header>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="printers">Printers</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <SpoolmanSettings />
          <HomeAssistantSettings />
        </TabsContent>

        <TabsContent value="printers">
          <PrintersSettings />
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4">
          <TimeoutSettings />
          <AutoAssignSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <React.Suspense>
      <SettingsContent />
    </React.Suspense>
  );
}
