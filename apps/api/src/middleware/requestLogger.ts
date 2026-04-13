import type { Request, Response, NextFunction } from "express";

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on("finish", () => {
    const latencyMs = Date.now() - start;
    const entry = {
      ts: new Date().toISOString(),
      level: "info",
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      latencyMs
    };
    console.log(JSON.stringify(entry));
  });

  next();
}
