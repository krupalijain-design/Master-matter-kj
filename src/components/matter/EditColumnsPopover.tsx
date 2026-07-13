import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Columns3, ChevronDown } from "lucide-react";
import { MATTER_COLUMNS, DEFAULT_COLUMN_KEYS } from "./columns";

export function EditColumnsPopover({
  value,
  onChange,
}: {
  value: string[];
  onChange: (keys: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (key: string) => {
    if (value.includes(key)) onChange(value.filter((k) => k !== key));
    else onChange([...value, key]);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <Columns3 className="h-3.5 w-3.5" />
          <span className="text-xs">Edit Columns</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
          Visible columns
        </div>
        <div className="max-h-72 overflow-y-auto py-1">
          {MATTER_COLUMNS.map((c) => (
            <label
              key={c.key}
              className="flex items-center gap-2 px-2 h-8 rounded hover:bg-muted cursor-pointer text-[13px]"
            >
              <Checkbox checked={value.includes(c.key)} onCheckedChange={() => toggle(c.key)} />
              <span className="flex-1 truncate">{c.label}</span>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between pt-2 border-t mt-1">
          <button
            className="text-[11px] text-muted-foreground hover:text-foreground px-2"
            onClick={() => onChange(DEFAULT_COLUMN_KEYS)}
          >
            Reset
          </button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)}>
            Done
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
