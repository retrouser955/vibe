import type { RequestHandler } from "express";
import { decodeJWT } from "@/web/createSecureToken.ts";

export const authenticateJWT: RequestHandler = (req, res, next) => {
    const authorization = req.headers.authorization;
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    const claims = match?.[1] ? decodeJWT(match[1]) : null;

    if (!claims) {
        res.status(401).json({ message: "Unauthorized" });
        return;
    }

    res.locals.auth = claims;
    next();
};
