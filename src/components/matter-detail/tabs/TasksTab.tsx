import { useState } from "react";
import { Plus, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cx } from "@/lib/format";
import type { Task, User } from "@/types";

const TYPES: Task["taskType"][] = ["Drafting", "Opinion", "Research", "Review", "Filing", "Complete matter details"];

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export function TasksTab({ matterId, tasks, users, onAdd, onToggle }: {
  matterId: string; tasks: Task[]; users: User[];
  onAdd: (t: Task) => void; onToggle: (id: string) => void;
}) {
  const [subject, setSubject] = useState("");
  const [type, setType] = useState<Task["taskType"]>("Drafting");
  const [assignee, setAssignee] = useState<string>(users[0]?.id ?? "");
  const [due, setDue] = useState(() => new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10));
  const [priority, setPriority] = useState<Task["priority"]>("Normal");
  const [completedOpen, setCompletedOpen] = useState(false);

  const open = tasks.filter((t) => t.status === "Open");
  const completed = tasks.filter((t) => t.status === "Completed");

  const add = () => {
    if (!subject.trim() || !assignee) return;
    onAdd({
      id: `t-${Date.now()}`,
      matterId,
      taskType: type,
      subject: subject.trim(),
      assigneeId: assignee,
      dueDate: new Date(due).toISOString(),
      status: "Open",
      priority,
      source: "Manual",
      createdAt: new Date().toISOString(),
    });
    setSubject("");
  };

  return (
    <div className="rounded-lg border shadow-sm overflow-hidden">
      <div className="p-3 bg-muted/30 grid grid-cols-[140px_1fr_150px_150px_120px_110px_auto] gap-2 items-center border-b">
        <Select value={type} onValueChange={(v) => setType(v as Task["taskType"])}>
          <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
          <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Task subject" className="h-8 text-[13px]" onKeyDown={(e) => e.key === "Enter" && add()} />
        <Select value={assignee} onValueChange={setAssignee}>
          <SelectTrigger className="h-8 text-[12px]"><SelectValue placeholder="Assignee" /></SelectTrigger>
          <SelectContent>{users.map((u) => <SelectItem key={u.id} value={u.id}>{u.fullName}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="h-8 text-[12px] font-mono" />
        <Select value={priority} onValueChange={(v) => setPriority(v as Task["priority"])}>
          <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="Normal">Normal</SelectItem><SelectItem value="High">High</SelectItem></SelectContent>
        </Select>
        <div />
        <Button size="sm" className="h-8 gap-1" onClick={add} disabled={!subject.trim() || !assignee}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      <table className="w-full editorial-table">
        <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/20">
          <tr>
            <th className="w-8 py-2" />
            <th className="text-left px-3 py-2">Task Type</th>
            <th className="text-left px-3 py-2">Subject</th>
            <th className="text-left px-3 py-2">Assigned By</th>
            <th className="text-left px-3 py-2">Assignee</th>
            <th className="text-left px-3 py-2">Due</th>
            <th className="text-left px-3 py-2">Status</th>
            <th className="text-left px-3 py-2">Priority</th>
          </tr>
        </thead>
        <tbody>
          {open.length === 0 && (
            <tr><td colSpan={8} className="text-center py-8 text-[13px]">
              <div className="font-medium">No open tasks</div>
              <div className="text-[11px] text-muted-foreground mt-1">Use the row above to add the first task.</div>
            </td></tr>
          )}
          {open.map((t) => (
            <TaskRow key={t.id} task={t} users={users} onToggle={onToggle} />
          ))}
        </tbody>
      </table>
      {completed.length > 0 && (
        <div className="border-t">
          <button onClick={() => setCompletedOpen((o) => !o)} className="w-full flex items-center gap-2 px-3 py-2 bg-muted/20 text-[12px] hover:bg-muted/40">
            <ChevronDown className={cx("h-3.5 w-3.5 transition-transform", !completedOpen && "-rotate-90")} />
            Completed ({completed.length})
          </button>
          {completedOpen && (
            <table className="w-full editorial-table">
              <tbody>
                {completed.map((t) => <TaskRow key={t.id} task={t} users={users} onToggle={onToggle} />)}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

function TaskRow({ task, users, onToggle }: { task: Task; users: User[]; onToggle: (id: string) => void }) {
  const done = task.status === "Completed";
  const assignee = users.find((u) => u.id === task.assigneeId);
  const assigner = task.assignedById ? users.find((u) => u.id === task.assignedById) : null;
  return (
    <tr className={cx("border-t hover:bg-muted/30 transition-all", done && "opacity-60")}>
      <td className="py-2.5 text-center">
        <button onClick={() => onToggle(task.id)} className={cx("h-4 w-4 rounded border grid place-items-center transition-colors", done ? "bg-success/20 border-success text-success" : "hover:bg-muted")} aria-label={done ? "Reopen" : "Complete"}>
          {done && <Check className="h-3 w-3" />}
        </button>
      </td>
      <td className="px-3 py-2.5"><Badge variant="outline" className="text-[10px] font-normal">{task.taskType}</Badge></td>
      <td className={cx("px-3 py-2.5", done && "line-through")}>{task.subject}</td>
      <td className="px-3 py-2.5 text-muted-foreground text-[12px]">{assigner?.fullName ?? "—"}</td>
      <td className="px-3 py-2.5">{assignee?.fullName ?? "—"}</td>
      <td className="px-3 py-2.5 font-mono tabular-nums text-[12px]">{fmtDate(task.dueDate)}</td>
      <td className="px-3 py-2.5">
        <span className={cx("inline-flex items-center gap-1 text-[11px] px-1.5 h-5 rounded border", done ? "text-success border-success/40 bg-success/10" : "text-accent border-accent/40 bg-accent/10")}>
          {done ? "Completed" : "Open"}
        </span>
      </td>
      <td className="px-3 py-2.5"><Badge variant="outline" className={cx("text-[10px] font-normal", task.priority === "High" ? "text-danger border-danger/40" : "")}>{task.priority}</Badge></td>
    </tr>
  );
}