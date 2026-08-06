type ChipColor = "success" | "warning" | "info" | "default";

export function getProjectStatusColor(status: string): ChipColor {
  switch (status) {
    case "public":
      return "success";
    case "unlisted":
      return "warning";
    default:
      return "default";
  }
}

export function getIdeaStatusColor(status: string): ChipColor {
  switch (status) {
    case "open":
      return "success";
    case "in_progress":
      return "warning";
    case "completed":
      return "info";
    default:
      return "default";
  }
}
