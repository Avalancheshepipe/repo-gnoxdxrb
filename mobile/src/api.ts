import { createTRPCReact } from "@trpc/react-query";
// Type-only import of the web app's router — shared end-to-end types, no runtime
// coupling (erased by the bundler).
import type { AppRouter } from "../../src/server/trpc/root";

export const api = createTRPCReact<AppRouter>();
