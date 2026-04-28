import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/scenarios/$id")({
  beforeLoad: () => { throw redirect({ to: "/simulator" }); },
  component: () => null,
});
