import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/sonner";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CapStack — Equity & VC Negotiation Simulator for Indian Founders" },
      { name: "description", content: "Model your cap table, simulate dilution across funding rounds, and walk into VC negotiations prepared. Built for Indian founders." },
      { name: "author", content: "CapStack" },
      { name: "keywords", content: "equity dilution, cap table, VC negotiation, startup funding, SAFE, liquidation preference, Indian startups, term sheet" },
      // Open Graph — controls WhatsApp, LinkedIn, Slack previews
      { property: "og:title", content: "CapStack — Equity & VC Negotiation Simulator" },
      { property: "og:description", content: "Model dilution, simulate exits, and decode VC term sheets before you sign. Free for Indian founders." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "CapStack" },
      // Twitter / X
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "CapStack — Equity & VC Negotiation Simulator" },
      { name: "twitter:description", content: "Model dilution, simulate exits, and decode VC term sheets before you sign. Free for Indian founders." },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster />
    </AuthProvider>
  );
}
