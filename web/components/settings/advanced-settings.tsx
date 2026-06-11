"use client";

import * as React from "react";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export function TimeoutSettings() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    printer_timeout: "10",
    printer_file_download_timeout: "60",
    spoolman_timeout: "30",
  });

  React.useEffect(() => {
    api
      .getConfig()
      .then((cfg) => {
        setForm({
          printer_timeout: cfg.printer_timeout || cfg.prusalink_timeout || "10",
          printer_file_download_timeout:
            cfg.printer_file_download_timeout ||
            cfg.prusalink_file_download_timeout ||
            "60",
          spoolman_timeout: cfg.spoolman_timeout || "30",
        });
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    const printerTimeout = Number(form.printer_timeout);
    const downloadTimeout = Number(form.printer_file_download_timeout);
    const spoolmanTimeout = Number(form.spoolman_timeout);
    if (printerTimeout < 5 || printerTimeout > 300) {
      toast.error("Timeout do Moonraker deve estar entre 5 e 300 segundos");
      return;
    }
    if (downloadTimeout < 10 || downloadTimeout > 600) {
      toast.error("Timeout de download deve estar entre 10 e 600 segundos");
      return;
    }
    if (spoolmanTimeout < 5 || spoolmanTimeout > 300) {
      toast.error("Timeout do Spoolman deve estar entre 5 e 300 segundos");
      return;
    }
    setSaving(true);
    try {
      await api.updateConfig(form);
      toast.success("Timeouts salvos");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const reset = () =>
    setForm({
      printer_timeout: "10",
      printer_file_download_timeout: "60",
      spoolman_timeout: "30",
    });

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader>
        <CardTitle className="text-base">Timeouts de API</CardTitle>
        <CardDescription>
          Ajuste apenas se estiver enfrentando problemas de conexão
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="printer_timeout">Moonraker (s)</Label>
            <Input
              id="printer_timeout"
              type="number"
              min={5}
              max={300}
              disabled={loading}
              value={form.printer_timeout}
              onChange={(e) =>
                setForm((f) => ({ ...f, printer_timeout: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="download_timeout">Download de G-code (s)</Label>
            <Input
              id="download_timeout"
              type="number"
              min={10}
              max={600}
              disabled={loading}
              value={form.printer_file_download_timeout}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  printer_file_download_timeout: e.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="spoolman_timeout">Spoolman (s)</Label>
            <Input
              id="spoolman_timeout"
              type="number"
              min={5}
              max={300}
              disabled={loading}
              value={form.spoolman_timeout}
              onChange={(e) =>
                setForm((f) => ({ ...f, spoolman_timeout: e.target.value }))
              }
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={save} disabled={saving || loading}>
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Salvar timeouts
          </Button>
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="size-4" />
            Restaurar padrões
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function AutoAssignSettings() {
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [enabled, setEnabled] = React.useState(false);
  const [location, setLocation] = React.useState("");
  const [locations, setLocations] = React.useState<string[]>([]);

  React.useEffect(() => {
    Promise.all([
      api.getAutoAssign().catch(() => ({ enabled: false, location: "" })),
      api.getLocations().catch(() => ({ locations: [], spoolman_url: "" })),
    ])
      .then(([settings, locationsRes]) => {
        setEnabled(settings.enabled);
        setLocation(settings.location ?? "");
        const names = (locationsRes.locations ?? [])
          .filter((loc) => !loc.is_virtual && loc.type !== "printer")
          .map((loc) => loc.name)
          .sort((a, b) => a.localeCompare(b));
        if (settings.location && !names.includes(settings.location)) {
          names.push(settings.location);
        }
        setLocations(names);
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.updateAutoAssign(enabled, location);
      toast.success("Configuração de atribuição automática salva");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-border/70 bg-card/60">
      <CardHeader>
        <CardTitle className="text-base">
          Atribuição automática de spool anterior
        </CardTitle>
        <CardDescription>
          Quando um novo spool é colocado em um toolhead, o spool anterior é
          movido automaticamente para um local padrão (caixa, prateleira,
          drybox)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch
            id="auto-assign"
            checked={enabled}
            disabled={loading}
            onCheckedChange={setEnabled}
          />
          <Label htmlFor="auto-assign">
            Mover spool anterior para o local padrão
          </Label>
        </div>
        {enabled && (
          <div className="space-y-1.5">
            <Label>Local padrão</Label>
            <Select value={location || undefined} onValueChange={setLocation}>
              <SelectTrigger className="w-full max-w-sm">
                <SelectValue placeholder="Selecione um local..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Os locais são gerenciados no Spoolman.
            </p>
          </div>
        )}
        <Button onClick={save} disabled={saving || loading}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
}
