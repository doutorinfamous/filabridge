"use client";

import * as React from "react";
import { AlertTriangle, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  api,
  formatRemainingWeight,
  spoolColor,
  spoolLabel,
} from "@/lib/api";
import type { PrintError, Spool } from "@/lib/types";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SpoolDot, SpoolWeightBadge } from "@/components/spool-select";

function formatGrams(grams: number): string {
  return `${grams.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}g`;
}

function canAssignSpool(err: PrintError): boolean {
  return (err.grams ?? 0) > 0 && err.toolhead_id != null;
}

function PrintErrorActions({
  err,
  onChanged,
}: {
  err: PrintError;
  onChanged: () => void;
}) {
  const [spoolOpen, setSpoolOpen] = React.useState(false);
  const [dismissOpen, setDismissOpen] = React.useState(false);
  const [loadingSpools, setLoadingSpools] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [spools, setSpools] = React.useState<Spool[]>([]);

  const loadSpools = async () => {
    setLoadingSpools(true);
    try {
      const list = await api.getSpools();
      setSpools(list ?? []);
    } catch {
      setSpools([]);
    } finally {
      setLoadingSpools(false);
    }
  };

  const handleSpoolOpenChange = (open: boolean) => {
    setSpoolOpen(open);
    if (open) {
      void loadSpools();
    }
  };

  const assignSpool = async (spoolId: number) => {
    setSpoolOpen(false);
    setSaving(true);
    try {
      await api.resolvePrintError(err.id, {
        action: "assign_spool",
        spool_id: spoolId,
      });
      toast.success("Consumo atribuído ao spool");
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao atribuir spool"
      );
    } finally {
      setSaving(false);
    }
  };

  const dismiss = async () => {
    setDismissOpen(false);
    setSaving(true);
    try {
      await api.resolvePrintError(err.id, { action: "dismiss" });
      toast.success("Impressão marcada como concluída");
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao concluir impressão"
      );
    } finally {
      setSaving(false);
    }
  };

  const spoolSearchValue = (spool: Spool) => {
    const weight = formatRemainingWeight(spool);
    return `${spool.id} ${spoolLabel(spool)}${weight ? ` ${weight}` : ""}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {canAssignSpool(err) && (
        <Popover open={spoolOpen} onOpenChange={handleSpoolOpenChange}>
          <PopoverTrigger asChild>
            <Button variant="secondary" size="sm" disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ChevronsUpDown className="size-4" />
              )}
              Atribuir a spool
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar spool..." />
              <CommandList>
                <CommandEmpty>
                  {loadingSpools ? "Carregando..." : "Nenhum spool encontrado"}
                </CommandEmpty>
                <CommandGroup>
                  {spools.map((spool) => (
                    <CommandItem
                      key={spool.id}
                      value={spoolSearchValue(spool)}
                      onSelect={() => assignSpool(spool.id)}
                    >
                      <SpoolDot color={spoolColor(spool)} />
                      <span className="min-w-0 flex-1 truncate">
                        {spoolLabel(spool)}
                      </span>
                      <SpoolWeightBadge spool={spool} />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )}

      <Button
        variant="outline"
        size="sm"
        disabled={saving}
        onClick={() => setDismissOpen(true)}
      >
        Concluir sem registrar
      </Button>

      <Dialog open={dismissOpen} onOpenChange={setDismissOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Concluir sem registrar uso?</DialogTitle>
            <DialogDescription>
              O consumo de filamento desta impressão não será debitado no
              Spoolman nem registrado no histórico. Todos os erros pendentes
              deste arquivo serão encerrados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDismissOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={dismiss} disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PrintErrors({
  errors,
  onChanged,
}: {
  errors: PrintError[];
  onChanged: () => void;
}) {
  if (errors.length === 0) return null;

  return (
    <div className="space-y-3">
      {errors.map((err) => (
        <Alert
          key={err.id}
          variant="destructive"
          className="border-destructive/40 bg-destructive/10"
        >
          <AlertTriangle className="size-4" />
          <AlertTitle>
            Falha ao processar impressão — {err.printer_name}
          </AlertTitle>
          <AlertDescription className="space-y-2 break-words">
            <p className="break-words">
              <span className="font-medium">Arquivo:</span> {err.filename}
              <span className="px-2 text-muted-foreground">·</span>
              <span className="font-medium">Quando:</span>{" "}
              {new Date(err.timestamp).toLocaleString("pt-BR")}
            </p>
            {(err.grams ?? 0) > 0 && err.toolhead_id != null && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="tabular-nums">
                  {formatGrams(err.grams ?? 0)}
                </Badge>
                <Badge variant="outline">
                  Toolhead {(err.toolhead_id ?? 0) + 1}
                </Badge>
              </div>
            )}
            <p className="break-words">{err.error}</p>
            <p className="text-xs text-muted-foreground">
              Escolha um spool para debitar o consumo ou conclua sem registrar
              no Spoolman.
            </p>
            <PrintErrorActions err={err} onChanged={onChanged} />
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
