import { createWebURL } from "@/lib/web.ts";
import { decodeJWT } from "@/web/createSecureToken.ts";
import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { api } from "./api/router.ts";

const app = express();
const server = createServer(app);

const io = new Server(server);

io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const claims = typeof token === "string" ? decodeJWT(token) : null;

    if(!claims) return next(new Error("Unauthorized"));

    socket.data.guild = claims.guild;
    next();
});

io.on("connection", (socket) => {
    socket.join(`guild:${socket.data.guild}`)
});

app.use("/api", api);

server.listen(process.env['PORT'], () => {
    console.log(`Server listening on ${createWebURL()}`);
});

export { io };