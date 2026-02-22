import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../services/prisma.js";
import config from "../config/index.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

function generateTokens(user: { user_id: string; email: string; role: string; team_id: string | null }) {
  const payload = {
    userId: user.user_id,
    email: user.email,
    role: user.role,
    teamId: user.team_id,
  };

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiry,
  } as jwt.SignOptions);

  const refreshToken = jwt.sign(
    { userId: user.user_id, type: "refresh" },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshTokenExpiry } as jwt.SignOptions,
  );

  return { accessToken, refreshToken };
}

// POST /api/v1/auth/register
router.post("/register", validate(RegisterSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, displayName } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError("Email already registered", 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password_hash: passwordHash,
        display_name: displayName,
      },
    });

    const tokens = generateTokens(user);

    res.status(201).json({
      user: {
        id: user.user_id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
      },
      ...tokens,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/login
router.post("/login", validate(LoginSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      throw new AppError("Invalid email or password", 401);
    }

    const tokens = generateTokens(user);

    res.json({
      user: {
        id: user.user_id,
        email: user.email,
        displayName: user.display_name,
        role: user.role,
        teamId: user.team_id,
      },
      ...tokens,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/auth/refresh
router.post("/refresh", validate(RefreshSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    const decoded = jwt.verify(refreshToken, config.jwt.secret) as { userId: string; type: string };
    if (decoded.type !== "refresh") {
      throw new AppError("Invalid refresh token", 401);
    }

    const user = await prisma.user.findUnique({ where: { user_id: decoded.userId } });
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const tokens = generateTokens(user);
    res.json(tokens);
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      next(new AppError("Invalid refresh token", 401));
      return;
    }
    next(err);
  }
});

export default router;
