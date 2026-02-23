import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import multer from "multer";
import { prisma } from "../services/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();
router.use(authenticate);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
});

// GET /api/v1/users/me
router.get("/me", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { user_id: req.user!.userId },
      select: {
        user_id: true,
        display_name: true,
        email: true,
        role: true,
        team_id: true,
        voice_embedding: false,
        created_at: true,
        team: {
          select: { team_id: true, name: true },
        },
      },
    });

    if (!user) throw new AppError("User not found", 404);
    res.json({
      id: user.user_id,
      email: user.email,
      displayName: user.display_name,
      role: user.role,
      teamId: user.team_id,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/users/me
router.patch("/me", validate(UpdateProfileSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data: Record<string, string> = {};
    if (req.body.displayName) data.display_name = req.body.displayName;

    const user = await prisma.user.update({
      where: { user_id: req.user!.userId },
      data,
      select: {
        user_id: true,
        display_name: true,
        email: true,
        role: true,
        team_id: true,
      },
    });

    res.json(user);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/users/me/voice-enrollment
router.post("/me/voice-enrollment", upload.single("audio"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new AppError("Audio file is required", 400);
    }

    // Store the raw audio buffer as voice embedding placeholder
    // In production, this would be processed by the diarization service
    // to extract the actual voice embedding vector
    await prisma.user.update({
      where: { user_id: req.user!.userId },
      data: { voice_embedding: new Uint8Array(req.file.buffer) },
    });

    res.json({ message: "Voice enrollment sample uploaded successfully" });
  } catch (err) {
    next(err);
  }
});

export default router;
