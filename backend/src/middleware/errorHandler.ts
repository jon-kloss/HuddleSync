import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

interface ErrorResponse {
  status: "error";
  message: string;
  statusCode: number;
  stack?: string;
}

export function globalErrorHandler(
  err: Error | AppError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const message = isAppError ? err.message : "Internal server error";

  console.error(`[ERROR] ${statusCode} - ${err.message}`, {
    stack: err.stack,
    isOperational: isAppError ? err.isOperational : false,
  });

  const body: ErrorResponse = {
    status: "error",
    message,
    statusCode,
  };

  if (process.env.NODE_ENV !== "production") {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
}
