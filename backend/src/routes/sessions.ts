import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();
router.use(authenticate);

const CreateSessionSchema = z.object({
  teamId: z.string().uuid(),
});

const MapSpeakerSchema = z.object({
  userId: z.string().uuid(),
});

// POST /api/v1/sessions
router.post("/", validate(CreateSessionSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { teamId } = req.body;
    const userId = req.user!.userId;

    const team = await prisma.team.findUnique({ where: { team_id: teamId } });
    if (!team) throw new AppError("Team not found", 404);

    const session = await prisma.huddleSession.create({
      data: {
        team_id: teamId,
        started_by: userId,
        status: "ACTIVE",
      },
    });

    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/sessions/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const session = await prisma.huddleSession.findUnique({
      where: { session_id: id },
      include: {
        transcript: {
          include: { speaker_segments: true },
        },
        summaries: {
          orderBy: { generated_at: "desc" },
          take: 1,
          include: { speaker_summaries: true },
        },
        starter: {
          select: { user_id: true, display_name: true, email: true },
        },
        team: {
          select: { team_id: true, name: true },
        },
      },
    });

    if (!session) throw new AppError("Session not found", 404);
    res.json(session);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/sessions/:id/end
router.patch("/:id/end", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const session = await prisma.huddleSession.findUnique({
      where: { session_id: id },
    });

    if (!session) throw new AppError("Session not found", 404);
    if (session.status !== "ACTIVE") throw new AppError("Session is not active", 400);

    const updated = await prisma.huddleSession.update({
      where: { session_id: id },
      data: {
        status: "PROCESSING",
        ended_at: new Date(),
      },
    });

    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/sessions/:id/summary
router.get("/:id/summary", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const summary = await prisma.summary.findFirst({
      where: { session_id: id },
      orderBy: [{ is_final: "desc" }, { generated_at: "desc" }],
      include: { speaker_summaries: true },
    });

    if (!summary) throw new AppError("No summary available for this session", 404);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/sessions/team/:teamId
router.get("/team/:teamId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.params.teamId as string;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      prisma.huddleSession.findMany({
        where: { team_id: teamId },
        orderBy: { started_at: "desc" },
        skip,
        take: limit,
        include: {
          starter: { select: { display_name: true } },
          summaries: {
            where: { is_final: true },
            take: 1,
            select: { content: true },
          },
        },
      }),
      prisma.huddleSession.count({ where: { team_id: teamId } }),
    ]);

    res.json({
      sessions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/v1/sessions/:id/speakers/:label
router.put("/:id/speakers/:label", validate(MapSpeakerSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const label = req.params.label as string;
    const { userId } = req.body;

    const session = await prisma.huddleSession.findUnique({
      where: { session_id: id },
      include: { transcript: true },
    });

    if (!session) throw new AppError("Session not found", 404);
    if (!session.transcript) throw new AppError("No transcript available", 404);

    await prisma.speakerSegment.updateMany({
      where: {
        transcript_id: session.transcript.transcript_id,
        speaker_label: label,
      },
      data: { user_id: userId },
    });

    res.json({ message: "Speaker mapped successfully" });
  } catch (err) {
    next(err);
  }
});

export default router;
