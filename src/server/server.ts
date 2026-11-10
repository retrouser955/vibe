import { createWebURL } from "@/lib/web.ts";
import { decodeJWT } from "@/web/createSecureToken.ts";
import express from "express";
import { createServer } from "node:http";
import { io } from "./socket.ts";
import { api } from "./api/index.ts";
import { Logger } from "commandkit";

let httpServer: ReturnType<typeof createServer> | undefined;

io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const claims = typeof token === "string" ? decodeJWT(token) : null;

    if (!claims) return next(new Error("Unauthorized"));

    socket.data.guild = claims.guild;
    next();
});

io.on("connection", (socket) => {
    socket.join(`guild:${socket.data.guild}`)
});

export function startServer() {
    if(httpServer) return httpServer;

    const app = express();
    app.use(express.json());
    app.use("/api", api);

    httpServer = createServer(app);
    io.attach(httpServer);

    httpServer.listen(process.env['PORT'], () => {
        Logger.info(`Server listening on ${createWebURL()}`);
    });
}

export { io };