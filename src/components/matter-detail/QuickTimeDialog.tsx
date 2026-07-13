import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActivityType, Matter } from "@/types";

const ACTIVITIES: ActivityType[] = ["Client Correspondence", "Client Meeting", "Draft Writing", "Review", "Research", "Hearing/Appearance"];

export function QuickTimeDialog({
  matter, open, onClose, onSave,
}: {
  matter: Matter;
  open: boolean;
  onClose: () => void;
  onSave: (e: { hours: number; minutes: number; activityType: ActivityType; narrative: string }) => void;
}) {
  const [hours, setHours] = useState(1);
  const [minutes, setMinutes] = useState(0);
  const [activity, setActivity] = useState<ActivityType>("Draft Writing");
  const [narr, setNarr] = useState("");
  useEffect(() => { if (open) { setHours(1); setMinutes(0); setActivity("Draft Writing"); setNarr(""); } }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">Log time · <span className="font-mono text-[13px]">#{matter.matterId}</span></DialogTitle>
          <div className="text-xs text-muted-foreground truncate">{matter.title}</div>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Hours</div>
              <Input type="number" min={0} max={24} value={hours} onChange={(e) => setHours(Math.max(0, Number(e.target.value) || 0))} className="h-9 font-mono" />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Minutes</div>
              <Input type="number" min={0} max={59} step={15} value={minutes} onChange={(e) => setMinutes(Math.max(0, Math.min(59, Number(e.target.value) || 0)))} className="h-9 font-mono" />
            </div>
            <div className="space-y-1 col-span-3">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Activity type</div>
              <Select value={activity} onValueChange={(v) => setActivity(v as ActivityType)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{ACTIVITIES.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Narrative</div>
            <Textarea rows={3} value={narr} onChange={(e) => setNarr(e.target.value)} placeholder="Describe the work in one line" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={(hours === 0 && minutes === 0) || !narr.trim()} onClick={() => onSave({ hours, minutes, activityType: activity, narrative: narr.trim() })}>
            Save entry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}