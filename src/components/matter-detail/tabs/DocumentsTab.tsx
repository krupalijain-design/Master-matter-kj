import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, FileText, Sparkles, ChevronRight, Download, Trash2, Eye, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cx } from "@/lib/format";

export type DocType = "Case Delivery" | "Case Delivery – Hearing" | "Client Document" | "Query Response" | "Other";

export interface DocVersion { label: string; uploadedAt: string; isFinal: boolean; }

export interface MatterDoc {
  id: string;
  title: string;
  type: DocType;
  versions: DocVersion[];
  headNote: string;
  tags?: string[];
}

const TYPES: DocType[] = ["Case Delivery", "Case Delivery – Hearing", "Client Document", "Query Response", "Other"];

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export function DocumentsTab({ docs, onChange, onHistory }: {
  docs: MatterDoc[];
  onChange: (next: MatterDoc[]) => void;
  onHistory: (msg: string) => void;
}) {
  const [filter, setFilter] = useState<"All" | DocType>("All");
  const [dropActive, setDropActive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [previewId, setPreviewId] = useState<string | null>(null);
  const dragCounter = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const enter = (e: DragEvent) => { e.preventDefault(); dragCounter.current++; setDropActive(true); };
    const over = (e: DragEvent) => e.preventDefault();
    const leave = () => { dragCounter.current--; if (dragCounter.current <= 0) { setDropActive(false); dragCounter.current = 0; } };
    const drop = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current = 0;
      setDropActive(false);
      const f = e.dataTransfer?.files?.[0];
      if (f) { setUploadName(f.name); setDialogOpen(true); }
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []);

  const visible = useMemo(() => filter === "All" ? docs : docs.filter((d) => d.type === filter), [docs, filter]);

  const openManualUpload = () => {
    fileInputRef.current?.click();
  };

  const onFilePicked = (f?: File) => {
    if (!f) return;
    setUploadName(f.name);
    setDialogOpen(true);
  };

  const commitUpload = (payload: { title: string; type: DocType; version: "Draft" | "Final"; tags: string[]; headNote: string }) => {
    const existing = docs.find((d) => d.title.toLowerCase() === payload.title.toLowerCase());
    if (existing) {
      const nextLabel = `v${existing.versions.length + 1}`;
      const updated: MatterDoc = {
        ...existing,
        headNote: payload.headNote || existing.headNote,
        tags: payload.tags.length ? payload.tags : existing.tags,
        versions: [...existing.versions.map((v) => ({ ...v, isFinal: payload.version === "Final" ? false : v.isFinal })), { label: nextLabel, uploadedAt: new Date().toISOString(), isFinal: payload.version === "Final" }],
      };
      onChange(docs.map((d) => d.id === existing.id ? updated : d));
      toast.success(`Uploaded ${payload.title} · ${nextLabel}`);
      onHistory(`Uploaded ${payload.title} ${nextLabel}`);
    } else {
      const doc: MatterDoc = {
        id: `doc-${Date.now()}`,
        title: payload.title,
        type: payload.type,
        versions: [{ label: "v1", uploadedAt: new Date().toISOString(), isFinal: payload.version === "Final" }],
        headNote: payload.headNote,
        tags: payload.tags,
      };
      onChange([doc, ...docs]);
      toast.success(`Uploaded ${payload.title}`);
      onHistory(`Uploaded new document ${payload.title}`);
    }
    setDialogOpen(false);
    setUploadName("");
  };

  const removeDoc = (id: string) => {
    const removed = docs.find((d) => d.id === id);
    onChange(docs.filter((d) => d.id !== id));
    toast("Document deleted", {
      description: removed?.title,
      action: { label: "Undo", onClick: () => { onChange([removed!, ...docs.filter((d) => d.id !== id)]); toast.success("Restored"); } },
      duration: 6000,
    });
    onHistory(`Deleted document ${removed?.title ?? id}`);
  };

  const preview = docs.find((d) => d.id === previewId);

  return (
    <div className="relative">
      <input ref={fileInputRef} type="file" hidden onChange={(e) => onFilePicked(e.target.files?.[0] ?? undefined)} />
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {(["All", ...TYPES] as ("All" | DocType)[]).map((t) => (
          <button key={t} onClick={() => setFilter(t)} className={cx("h-7 px-2.5 rounded-full border text-[11px]", filter === t ? "bg-accent/15 border-accent/40 text-accent" : "border-border text-muted-foreground hover:text-foreground")}>{t}</button>
        ))}
        <div className="ml-auto">
          <Button size="sm" className="h-8 gap-1.5" onClick={openManualUpload}>
            <Upload className="h-3.5 w-3.5" /> Upload
          </Button>
        </div>
      </div>

      <div className="rounded-lg border shadow-sm overflow-hidden">
        <table className="w-full editorial-table">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/20">
            <tr>
              <th className="w-6" />
              <th className="text-left px-3 py-2">Title</th>
              <th className="text-left px-3 py-2">Type</th>
              <th className="text-left px-3 py-2">Latest</th>
              <th className="text-left px-3 py-2">Uploaded</th>
              <th className="w-32" />
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
              <tr><td colSpan={6} className="text-center py-10 text-[13px]">
                <div className="font-medium">No documents in this view</div>
                <div className="text-[11px] text-muted-foreground mt-1">Drop a file anywhere on this page or click Upload.</div>
              </td></tr>
            )}
            {visible.map((d) => {
              const latest = d.versions[d.versions.length - 1];
              const isOpen = expanded.has(d.id);
              return (
                <Fragment key={d.id}>
                  <tr className="border-t hover:bg-muted/30">
                    <td className="text-center">
                      {d.versions.length > 1 && (
                        <button onClick={() => setExpanded((s) => { const n = new Set(s); n.has(d.id) ? n.delete(d.id) : n.add(d.id); return n; })} className="h-5 w-5 grid place-items-center rounded hover:bg-muted" aria-label="Toggle versions">
                          <ChevronRight className={cx("h-3 w-3 transition-transform", isOpen && "rotate-90")} />
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2"><FileText className="h-3.5 w-3.5 text-muted-foreground" /><span className="font-medium">{d.title}</span></div>
                      {d.headNote && <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{d.headNote}</div>}
                    </td>
                    <td className="px-3 py-2.5"><Badge variant="outline" className="text-[10px] font-normal">{d.type}</Badge></td>
                    <td className="px-3 py-2.5">
                      <span className="font-mono tabular-nums text-[12px]">{latest.label}</span>
                      {latest.isFinal && <Badge className="ml-1.5 text-[10px] h-4 bg-success/15 text-success border-success/30" variant="outline">Final</Badge>}
                    </td>
                    <td className="px-3 py-2.5 font-mono tabular-nums text-[12px] text-muted-foreground">{fmtDate(latest.uploadedAt)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => setPreviewId(d.id)} className="h-6 w-6 grid place-items-center rounded hover:bg-muted text-muted-foreground" aria-label="Preview"><Eye className="h-3.5 w-3.5" /></button>
                        <button onClick={() => toast(`Downloading ${d.title} ${latest.label}`)} className="h-6 w-6 grid place-items-center rounded hover:bg-muted text-muted-foreground" aria-label="Download"><Download className="h-3.5 w-3.5" /></button>
                        <button onClick={() => removeDoc(d.id)} className="h-6 w-6 grid place-items-center rounded hover:bg-muted text-danger" aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                  {isOpen && d.versions.slice().reverse().map((v) => (
                    <tr key={`${d.id}-${v.label}`} className="bg-muted/10 border-t">
                      <td />
                      <td className="px-3 py-2 pl-9 text-[12px] text-muted-foreground">Version {v.label}</td>
                      <td />
                      <td className="px-3 py-2 font-mono tabular-nums text-[12px]">{v.label}{v.isFinal && <Badge className="ml-1.5 text-[10px] h-4 bg-success/15 text-success border-success/30" variant="outline">Final</Badge>}</td>
                      <td className="px-3 py-2 font-mono tabular-nums text-[12px] text-muted-foreground">{fmtDate(v.uploadedAt)}</td>
                      <td />
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {dropActive && (
        <div className="fixed inset-0 z-50 pointer-events-none grid place-items-center bg-accent/10 backdrop-blur-sm">
          <div className="rounded-lg border-2 border-dashed border-accent bg-background p-10 text-center shadow-lg">
            <Upload className="h-8 w-8 mx-auto text-accent" />
            <div className="mt-2 text-[15px] font-medium">Drop to upload</div>
            <div className="text-[12px] text-muted-foreground">Filed to this matter after you confirm the details.</div>
          </div>
        </div>
      )}

      <UploadDialog open={dialogOpen} defaultTitle={uploadName} onClose={() => { setDialogOpen(false); setUploadName(""); }} onSubmit={commitUpload} />

      <Sheet open={!!preview} onOpenChange={(v) => !v && setPreviewId(null)}>
        <SheetContent side="right" className="w-[560px] sm:max-w-none p-0">
          {preview && (
            <>
              <SheetHeader className="px-5 py-4 border-b">
                <SheetTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> {preview.title}</SheetTitle>
                <div className="text-[11px] text-muted-foreground">{preview.type} · latest {preview.versions[preview.versions.length - 1].label}</div>
              </SheetHeader>
              <div className="p-5 space-y-4">
                <div className="rounded border bg-muted/20 aspect-[3/4] grid place-items-center text-muted-foreground text-[12px]">
                  <div className="text-center">
                    <Lock className="h-6 w-6 mx-auto opacity-50" />
                    <div className="mt-2">Preview available on download.</div>
                  </div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Head note</div>
                  <div className="text-[13px] mt-1">{preview.headNote || <span className="italic text-muted-foreground">No head note.</span>}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="h-8" onClick={() => toast(`Downloading ${preview.title}`)}><Download className="h-3.5 w-3.5 mr-1" /> Download</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function UploadDialog({ open, defaultTitle, onClose, onSubmit }: {
  open: boolean; defaultTitle: string; onClose: () => void;
  onSubmit: (p: { title: string; type: DocType; version: "Draft" | "Final"; tags: string[]; headNote: string }) => void;
}) {
  const [title, setTitle] = useState(defaultTitle);
  const [type, setType] = useState<DocType>("Case Delivery");
  const [version, setVersion] = useState<"Draft" | "Final">("Draft");
  const [tags, setTags] = useState("");
  const [headNote, setHeadNote] = useState("");
  useEffect(() => { if (open) { setTitle(defaultTitle || ""); setType("Case Delivery"); setVersion("Draft"); setTags(""); setHeadNote(""); } }, [open, defaultTitle]);

  const draftAI = () => {
    const suggestion = `${type === "Case Delivery" ? "Filed under case delivery" : "Client document"}: ${title || "untitled"}. Two-line summary generated from title and file metadata; edit as needed.`;
    setHeadNote(suggestion);
    toast("Draft suggestion added", { description: "Review and edit before saving." });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Upload document</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Title</div>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" className="h-9" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Type</div>
              <Select value={type} onValueChange={(v) => setType(v as DocType)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select></div>
            <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Version</div>
              <Select value={version} onValueChange={(v) => setVersion(v as "Draft" | "Final")}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Draft">Draft</SelectItem><SelectItem value="Final">Final</SelectItem></SelectContent>
              </Select></div>
          </div>
          <div><div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Tags</div>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Comma-separated" className="h-9" /></div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Head note</div>
              <Button size="sm" variant="ghost" className="h-6 gap-1 text-[11px]" onClick={draftAI}><Sparkles className="h-3 w-3" /> Draft with AI</Button>
            </div>
            <Textarea rows={3} value={headNote} onChange={(e) => setHeadNote(e.target.value)} placeholder="Two-line head note" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!title.trim()} onClick={() => onSubmit({ title: title.trim(), type, version, tags: tags.split(",").map((s) => s.trim()).filter(Boolean), headNote: headNote.trim() })}>Upload</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}