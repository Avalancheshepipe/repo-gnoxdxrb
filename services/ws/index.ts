import "dotenv/config";
import { Database } from "@hocuspocus/extension-database";
import { Server } from "@hocuspocus/server";
import { prisma } from "@/server/db";
import { env } from "@/server/env";

// Realtime collaboration server for the canvas.
// documentName === projectId. Auth uses the better-auth session token.
const server = new Server({
  port: env.WS_PORT,
  quiet: env.isProd,
  extensions: [
    new Database({
      fetch: async ({ documentName }) => {
        const doc = await prisma.canvasDoc.findUnique({
          where: { projectId: documentName },
          select: { state: true },
        });
        return doc?.state ? new Uint8Array(doc.state) : null;
      },
      store: async ({ documentName, state }) => {
        const bytes = new Uint8Array(state);
        await prisma.canvasDoc.upsert({
          where: { projectId: documentName },
          update: { state: bytes, version: { increment: 1 } },
          create: { projectId: documentName, state: bytes },
        });
      },
    }),
  ],
  onAuthenticate: async ({ token, documentName }) => {
    const session = await prisma.session.findUnique({
      where: { token },
      select: { userId: true, expiresAt: true },
    });
    if (!session || session.expiresAt < new Date()) {
      throw new Error("Invalid or expired session");
    }

    const project = await prisma.project.findUnique({
      where: { id: documentName },
      select: { organizationId: true },
    });
    if (!project) throw new Error("Unknown project");

    const member = await prisma.member.findUnique({
      where: {
        organizationId_userId: {
          organizationId: project.organizationId,
          userId: session.userId,
        },
      },
      include: { user: { select: { name: true, image: true } } },
    });
    if (!member) throw new Error("Forbidden");

    return {
      userId: session.userId,
      name: member.user.name,
      image: member.user.image,
      role: member.role,
    };
  },
});

server.listen().then(() => {
  console.log(`Julow realtime server listening on ws://0.0.0.0:${env.WS_PORT}`);
});

async function shutdown() {
  await server.destroy();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
