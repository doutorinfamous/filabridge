"use client";

import * as React from "react";
import {
  Boxes,
  CheckCircle2,
  Download,
  Loader2,
  Pencil,
  Plus,
  Printer,
  Tags,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import type { BambuPrinter, PrinterConfigInfo } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface PrinterFormState {
  name: string;
  ip_address: string;
  api_key: string;
  model: string;
  toolheads: number;
}

const emptyForm: PrinterFormState = {
  name: "",
  ip_address: "",
  api_key: "",
  model: "Snapmaker U1",
  toolheads: 1,
};

function PrinterFormFields({
  form,
  setForm,
}: {
  form: PrinterFormState;
  setForm: React.Dispatch<React.SetStateAction<PrinterFormState>>;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="printer-name">Nome *</Label>
        <Input
          id="printer-name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Ex.: Snapmaker U1"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="printer-ip">Hostname ou IP *</Label>
        <Input
          id="printer-ip"
          value={form.ip_address}
          onChange={(e) =>
            setForm((f) => ({ ...f, ip_address: e.target.value }))
          }
          placeholder="192.168.1.100 ou printer.local"
        />
        <p className="text-xs text-muted-foreground">
          Endereço da instância Moonraker da Snapmaker U1
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="printer-key">API Key (opcional)</Label>
        <Input
          id="printer-key"
          type="password"
          value={form.api_key}
          onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
          placeholder="Apenas se o Moonraker exigir autenticação"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Modelo</Label>
          <Select
            value={form.model}
            onValueChange={(v) => setForm((f) => ({ ...f, model: v }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Snapmaker U1">Snapmaker U1</SelectItem>
              <SelectItem value="Unknown">Desconhecido</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Toolheads</Label>
          <Select
            value={String(form.toolheads)}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, toolheads: Number(v) }))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} toolhead{n > 1 ? "s" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function ToolheadNamesEditor({
  printerId,
  printer,
  onSaved,
}: {
  printerId: string;
  printer: PrinterConfigInfo;
  onSaved: () => void;
}) {
  const [names, setNames] = React.useState<Record<number, string>>(
    printer.toolhead_names ?? {}
  );
  const [saving, setSaving] = React.useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(names).filter(([id, name]) => {
        const original =
          printer.toolhead_names?.[Number(id)] ?? `Toolhead ${Number(id) + 1}`;
        return name.trim() !== "" && name.trim() !== original;
      });
      if (updates.length === 0) {
        toast.info("Nada para salvar");
        return;
      }
      await Promise.all(
        updates.map(([id, name]) =>
          api.setToolheadName(printerId, Number(id), name.trim())
        )
      );
      toast.success("Nomes dos toolheads salvos");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-background/40 p-3">
      {Array.from({ length: printer.toolheads }, (_, i) => i).map((id) => (
        <div key={id} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-sm text-muted-foreground">
            Toolhead {id + 1}
          </span>
          <Input
            value={names[id] ?? `Toolhead ${id + 1}`}
            onChange={(e) =>
              setNames((n) => ({ ...n, [id]: e.target.value }))
            }
            className="h-8"
          />
        </div>
      ))}
      <Button size="sm" onClick={save} disabled={saving}>
        {saving && <Loader2 className="size-3.5 animate-spin" />}
        Salvar nomes
      </Button>
    </div>
  );
}

export function PrintersSettings() {
  const [printers, setPrinters] = React.useState<Record<
    string,
    PrinterConfigInfo
  > | null>(null);
  const [addOpen, setAddOpen] = React.useState(false);
  const [addBusy, setAddBusy] = React.useState(false);
  const [addForm, setAddForm] = React.useState<PrinterFormState>(emptyForm);

  const [editId, setEditId] = React.useState<string | null>(null);
  const [editBusy, setEditBusy] = React.useState(false);
  const [editForm, setEditForm] = React.useState<PrinterFormState>(emptyForm);

  const [bambuOpen, setBambuOpen] = React.useState(false);
  const [bambuList, setBambuList] = React.useState<BambuPrinter[] | null>(null);
  const [bambuError, setBambuError] = React.useState<string | null>(null);

  const [renamingId, setRenamingId] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await api.getPrinters();
      const entries = Object.fromEntries(
        Object.entries(res.printers ?? {}).filter(([id]) => id !== "no_printers")
      );
      setPrinters(entries);
    } catch {
      setPrinters({});
      toast.error("Falha ao carregar impressoras");
    }
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(load, 0);
    return () => clearTimeout(timer);
  }, [load]);

  const addPrinter = async () => {
    if (!addForm.name.trim() || !addForm.ip_address.trim()) {
      toast.error("Preencha nome e endereço");
      return;
    }
    setAddBusy(true);
    try {
      // Detect the model first (non-blocking if the printer is offline)
      let model = addForm.model;
      try {
        const detection = await api.detectPrinter(
          addForm.ip_address.trim(),
          addForm.api_key
        );
        if (detection.detected && detection.model) model = detection.model;
      } catch {
        // keep selected model
      }
      await api.addPrinter({
        name: addForm.name.trim(),
        model,
        ip_address: addForm.ip_address.trim(),
        api_key: addForm.api_key,
        toolheads: addForm.toolheads,
      });
      toast.success("Impressora adicionada");
      setAddOpen(false);
      setAddForm(emptyForm);
      load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao adicionar impressora"
      );
    } finally {
      setAddBusy(false);
    }
  };

  const openEdit = (printerId: string, printer: PrinterConfigInfo) => {
    setEditId(printerId);
    setEditForm({
      name: printer.name,
      ip_address: printer.ip_address,
      api_key: printer.api_key,
      model: printer.model || "Unknown",
      toolheads: printer.toolheads || 1,
    });
  };

  const saveEdit = async () => {
    if (!editId) return;
    setEditBusy(true);
    try {
      await api.updatePrinter(editId, {
        name: editForm.name.trim(),
        model: editForm.model,
        ip_address: editForm.ip_address.trim(),
        api_key: editForm.api_key,
        toolheads: editForm.toolheads,
      });
      toast.success("Impressora atualizada");
      setEditId(null);
      load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao atualizar impressora"
      );
    } finally {
      setEditBusy(false);
    }
  };

  const remove = async (printerId: string, name: string) => {
    if (!confirm(`Remover a impressora "${name}"?`)) return;
    try {
      await api.deletePrinter(printerId);
      toast.success("Impressora removida");
      load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao remover impressora"
      );
    }
  };

  const openBambuDiscovery = async () => {
    setBambuOpen(true);
    setBambuList(null);
    setBambuError(null);
    try {
      const list = await api.getBambuPrinters();
      setBambuList((list ?? []).filter((p) => !p.registered));
    } catch (error) {
      setBambuError(
        error instanceof Error
          ? error.message
          : "Falha na descoberta — configure o Home Assistant primeiro"
      );
      setBambuList([]);
    }
  };

  const registerBambu = async (printer: BambuPrinter) => {
    try {
      await api.registerBambuPrinter(printer);
      toast.success(
        "Impressora Bambu registrada! Gere o pacote HA e reinicie o Home Assistant."
      );
      setBambuOpen(false);
      load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao registrar impressora"
      );
    }
  };

  const downloadHAConfig = async (printerId: string) => {
    try {
      const data = await api.getHAAutomations(printerId);
      const blob = new Blob([data.yaml], { type: "text/yaml" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = data.filename || "filabridge_ha.yaml";
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success(
        `YAML baixado. Salve em config/packages/${data.filename} e reinicie o HA por completo. Webhook: ${data.webhook_url}`,
        { duration: 12000 }
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao gerar configuração"
      );
    }
  };

  const validateHA = async (printerId: string) => {
    try {
      const data = await api.validateHA(printerId);
      if (data.all_ok) {
        toast.success("Home Assistant: as 4 entidades do FilaBridge estão OK");
        return;
      }
      const missing = data.checks
        .filter((c) => !c.found)
        .map((c) => c.entity_id)
        .join(", ");
      toast.error(
        `Entidades faltando no HA: ${missing}. Reinstale o pacote ${data.package_file} e reinicie o HA.`,
        { duration: 12000 }
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao validar HA"
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="size-4" /> Impressora Moonraker
        </Button>
        <Button variant="outline" onClick={openBambuDiscovery}>
          <Plus className="size-4" /> Bambu Lab (HA)
        </Button>
      </div>

      {printers === null ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : Object.keys(printers).length === 0 ? (
        <Card className="border-dashed bg-card/40">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhuma impressora configurada. Adicione uma acima para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {Object.entries(printers).map(([printerId, printer]) => {
            const isBambu = printer.driver === "bambu_ha";
            return (
              <Card key={printerId} className="border-border/70 bg-card/60">
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-lg border border-border/70 bg-background/60">
                      {isBambu ? (
                        <Boxes className="size-4.5 text-emerald-400" />
                      ) : (
                        <Printer className="size-4.5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base">{printer.name}</CardTitle>
                      <CardDescription>
                        {isBambu
                          ? `ha-bambulab · prefixo ${printer.ha_prefix || "?"}`
                          : `${printer.model || "Moonraker"} · ${printer.ip_address}`}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    {isBambu
                      ? "Bambu HA"
                      : `${printer.toolheads} toolhead${printer.toolheads > 1 ? "s" : ""}`}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {isBambu ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadHAConfig(printerId)}
                        >
                          <Download className="size-3.5" /> Pacote HA
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => validateHA(printerId)}
                        >
                          <CheckCircle2 className="size-3.5" /> Validar HA
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(printerId, printer)}
                        >
                          <Pencil className="size-3.5" /> Editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setRenamingId((id) =>
                              id === printerId ? null : printerId
                            )
                          }
                        >
                          <Tags className="size-3.5" /> Toolheads
                        </Button>
                      </>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => remove(printerId, printer.name)}
                    >
                      <Trash2 className="size-3.5" /> Remover
                    </Button>
                  </div>
                  {!isBambu && renamingId === printerId && (
                    <ToolheadNamesEditor
                      printerId={printerId}
                      printer={printer}
                      onSaved={() => {
                        setRenamingId(null);
                        load();
                      }}
                    />
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Moonraker printer */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar impressora Moonraker</DialogTitle>
            <DialogDescription>
              Snapmaker U1 ou outra impressora Klipper/Moonraker
            </DialogDescription>
          </DialogHeader>
          <PrinterFormFields form={addForm} setForm={setAddForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={addPrinter} disabled={addBusy}>
              {addBusy && <Loader2 className="size-4 animate-spin" />}
              {addBusy ? "Detectando modelo..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit printer */}
      <Dialog open={editId !== null} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar impressora</DialogTitle>
          </DialogHeader>
          <PrinterFormFields form={editForm} setForm={setEditForm} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)}>
              Cancelar
            </Button>
            <Button onClick={saveEdit} disabled={editBusy}>
              {editBusy && <Loader2 className="size-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bambu discovery */}
      <Dialog open={bambuOpen} onOpenChange={setBambuOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Bambu Lab (Home Assistant)</DialogTitle>
            <DialogDescription>
              Impressoras descobertas via ha-bambulab. Configure URL e token do
              HA na aba Geral antes.
            </DialogDescription>
          </DialogHeader>
          <Separator />
          {bambuList === null ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Descobrindo
              impressoras...
            </div>
          ) : bambuError ? (
            <p className="py-4 text-sm text-destructive">{bambuError}</p>
          ) : bambuList.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              Nenhuma impressora Bambu não registrada encontrada no Home
              Assistant.
            </p>
          ) : (
            <div className="space-y-2">
              {bambuList.map((printer) => (
                <button
                  key={printer.device_id || printer.prefix}
                  onClick={() => registerBambu(printer)}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-background/50 px-4 py-3 text-left transition-colors hover:bg-accent"
                >
                  <span>
                    <span className="block text-sm font-medium">
                      {printer.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {printer.prefix}
                    </span>
                  </span>
                  <Plus className="size-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
