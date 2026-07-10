export type DashboardReadiness = {
  status: "ready" | "warning" | "blocked";
  summary: string;
  counts: {
    ready: number;
    warning: number;
    blocked: number;
  };
  items: Array<{
    id: string;
    label: string;
    status: "ready" | "warning" | "blocked";
    message: string;
    action: string;
  }>;
};
