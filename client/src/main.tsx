import { trpc } from "@/lib/trpc";
import { isUnauthorizedApiError, reportApiError } from "@/lib/apiErrorReporting";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Disable refetch on every tab focus — the biggest hidden source of background requests.
      // Individual queries that need fresh data on focus can override this locally.
      refetchOnWindowFocus: false,
      // Default stale time: 5 minutes. Prevents redundant re-fetches when the same query
      // is mounted by multiple components on the same page.
      staleTime: 5 * 60 * 1000,
      // Keep unused query data in cache for 10 minutes before garbage collecting.
      gcTime: 10 * 60 * 1000,
    },
  },
});

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (typeof window === "undefined") return;

  if (!isUnauthorizedApiError(error)) return;

  try {
    window.location.href = getLoginUrl();
  } catch (loginError) {
    console.info(
      "[Auth] Login redirect unavailable",
      loginError instanceof Error ? loginError.message : String(loginError),
    );
  }
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    reportApiError("Query", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    reportApiError("Mutation", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
