// src/server.ts
console.log("🔥 SERVER.TS VERSION = AVEC NOTIFICATIONS");
import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import session from "express-session";

import healthRouter from "./routes/health";
import exampleRouter from "./routes/example";
import dbcheckRouter from "./routes/dbcheck";
import catalogRouter from "./routes/catalog";
import albumsRouter from "./routes/albums";
import searchRouter from "./routes/search";
import suggestRouter from "./routes/suggest";
import artistsRouter from "./routes/artists";
import authRouter from "./routes/auth";
import diaryRouter from "./routes/diary";
import tracksRouter from "./routes/tracks";
import socialRouter from "./routes/social";
import profilesRouter from "./routes/profiles";
import settingsRouter from "./routes/settings";
import notificationsRouter from "./routes/notifications";
import adminRouter from "./routes/admin";

const app = express();

// 🔑 Important : en dev ou derrière proxy
app.set("trust proxy", 1);

app.use(helmet());

// CORS pour autoriser frontend à envoyer les cookies
app.use(
    cors({
        origin: process.env.CORS_ORIGIN || "http://localhost:3000",
        credentials: true, // 👈 indispensable pour que les cookies passent
    })
);

app.use(express.json());

// ⚠️ La session DOIT être montée avant toutes les routes
app.use(
    session({
        name: "mbx.sid",
        secret: process.env.COOKIE_SECRET || "dev-secret-change-me",
        resave: false,
        saveUninitialized: true, // 👈 crée toujours une session (utile pour OAuth)
        cookie: {
            httpOnly: true,
            sameSite: "lax", // 👈 accepte cookie entre ports différents (3000 <-> 4000)
            secure: false, // 👈 en dev HTTP, mettre true seulement en prod HTTPS
            maxAge: 1000 * 60 * 60 * 24, // 1 jour
        },
    })
);

// Routes
app.use("/health", healthRouter);
app.use("/example", exampleRouter);
app.use("/dbcheck", dbcheckRouter);
app.use("/catalog", catalogRouter);
app.use("/albums", albumsRouter);
app.use("/search", searchRouter);
app.use("/search/suggest", suggestRouter);
app.use("/artists", artistsRouter);
app.use("/auth", authRouter);
app.use("/diary", diaryRouter);
app.use("/tracks", tracksRouter);
app.use("/social", socialRouter);
app.use("/profiles", profilesRouter);
app.use("/settings", settingsRouter);
console.log("🔥 mounting /notifications router");
app.use("/notifications", notificationsRouter); 
app.use("/api", adminRouter);

// 404
app.use((_req: Request, res: Response) =>
    res.status(404).json({ error: "Not found" })
);

// Handler d'erreurs
app.use(
    (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
        console.error(err);
        res.status(500).json({ error: "Internal error" });
    }
);

const port = Number(process.env.PORT || 4000);
app.listen(port, () =>
    console.log(`✅ API listening on http://localhost:${port}`)
);
