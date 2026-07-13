export function getMetricColor(label: string, isWarning?: boolean): string {
  if (isWarning) {
    return "#D97706"; // Amber override for warning states
  }
  const cleanLabel = label.toLowerCase().trim();

  // Group 1: Blue (#378ADD)
  if (
    cleanLabel.includes("active matters") ||
    cleanLabel.includes("live matters") ||
    cleanLabel.includes("straight-through") ||
    cleanLabel.includes("intake") ||
    cleanLabel.includes("pipeline")
  ) {
    return "#378ADD";
  }

  // Group 2: Teal (#1D9E75)
  if (
    cleanLabel.includes("revenue") ||
    cleanLabel.includes("billing") ||
    cleanLabel.includes("billed") ||
    cleanLabel.includes("maker queue") ||
    cleanLabel.includes("avg human") ||
    cleanLabel.includes("seconds")
  ) {
    return "#1D9E75";
  }

  // Group 3: Green (#639922)
  if (
    cleanLabel.includes("realization") ||
    cleanLabel.includes("collected") ||
    cleanLabel.includes("collection") ||
    cleanLabel.includes("docketer") ||
    cleanLabel.includes("acceptance") ||
    cleanLabel.includes("saves")
  ) {
    return "#639922";
  }

  // Group 4: Purple (#534AB7)
  if (
    cleanLabel.includes("aged wip") ||
    cleanLabel.includes("aged unbilled") ||
    cleanLabel.includes("error") ||
    cleanLabel.includes("override") ||
    cleanLabel.includes("deadline") ||
    cleanLabel.includes("overdue")
  ) {
    return "#534AB7";
  }

  // Rotating fallback using a clean hash to always stay within the 4 cool hues
  let hash = 0;
  for (let i = 0; i < cleanLabel.length; i++) {
    hash = cleanLabel.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ["#378ADD", "#1D9E75", "#639922", "#534AB7"];
  return colors[Math.abs(hash) % colors.length];
}
