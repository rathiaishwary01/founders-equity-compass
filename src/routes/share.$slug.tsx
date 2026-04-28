import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/share/$slug")({
  beforeLoad: () => { throw redirect({ to: "/simulator" }); },
  component: () => null,
});
