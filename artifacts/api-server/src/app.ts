import express, { type Express } from "express";
import cors from "cors";
import type { IncomingMessage, ServerResponse } from "http";
import router from "./routes";
import { logger } from "./lib/logger";

// pino-http uses `export =` which conflicts with moduleResolution:bundler.
// Import via the namespace form and cast to callable to satisfy all TS versions.
import * as pinoHttpNs from "pino-http";
type PinoHttpFn = (opts: pinoHttpNs.Options) => pinoHttpNs.HttpLogger;
const pinoHttp = pinoHttpNs as unknown as PinoHttpFn;

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: IncomingMessage & { id?: unknown }) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res: ServerResponse) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
