import jwt from "jsonwebtoken";

export function generateJWT(userId: string, guildId: string) {
    const payload = {
        user: userId,
        guild: guildId
    }

    const accessToken = jwt.sign(payload, process.env['DASHBOARD_TOKEN']!, {
        expiresIn: "3h"
    });

    return accessToken;
}

export function decodeJWT(token: string) {
    try {
        const decoded = jwt.verify(token, process.env['DASHBOARD_TOKEN']!);
        return decoded as jwt.JwtPayload & { user: string, guild: string };
    } catch {
        // invalide JWT
        return null;
    }
}