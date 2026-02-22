import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { prisma } from "../services/prisma.js";
import { authenticate, authorize } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { AppError } from "../middleware/errorHandler.js";

const router = Router();
router.use(authenticate);

const CreateTeamSchema = z.object({
  name: z.string().min(1).max(100),
});

const AddMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "MEMBER", "GUEST"]).default("MEMBER"),
});

// POST /api/v1/teams
router.post("/", validate(CreateTeamSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;
    const userId = req.user!.userId;

    const team = await prisma.team.create({
      data: {
        name,
        owner_user_id: userId,
      },
    });

    // Add creator as team member with ADMIN role
    await prisma.user.update({
      where: { user_id: userId },
      data: { team_id: team.team_id, role: "ADMIN" },
    });

    res.status(201).json(team);
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/teams/:id
router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const team = await prisma.team.findUnique({
      where: { team_id: req.params.id as string },
      include: {
        members: {
          select: {
            user_id: true,
            display_name: true,
            email: true,
            role: true,
          },
        },
        owner: {
          select: { user_id: true, display_name: true, email: true },
        },
      },
    });

    if (!team) throw new AppError("Team not found", 404);
    res.json(team);
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/teams/:id/members
router.post("/:id/members", validate(AddMemberSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.params.id as string;
    const { email, role } = req.body;

    // Verify the requester is an admin of this team
    const team = await prisma.team.findUnique({ where: { team_id: teamId } });
    if (!team) throw new AppError("Team not found", 404);
    if (team.owner_user_id !== req.user!.userId && req.user!.role !== "ADMIN") {
      throw new AppError("Only team admins can add members", 403);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError("User not found with that email", 404);

    await prisma.user.update({
      where: { user_id: user.user_id },
      data: { team_id: teamId, role },
    });

    res.json({
      message: "Member added successfully",
      member: {
        id: user.user_id,
        displayName: user.display_name,
        email: user.email,
        role,
      },
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/teams/:id/members/:userId
router.delete("/:id/members/:userId", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.params.id as string;
    const userId = req.params.userId as string;

    const team = await prisma.team.findUnique({ where: { team_id: teamId } });
    if (!team) throw new AppError("Team not found", 404);
    if (team.owner_user_id !== req.user!.userId && req.user!.role !== "ADMIN") {
      throw new AppError("Only team admins can remove members", 403);
    }

    if (userId === team.owner_user_id) {
      throw new AppError("Cannot remove team owner", 400);
    }

    await prisma.user.update({
      where: { user_id: userId },
      data: { team_id: null, role: "MEMBER" },
    });

    res.json({ message: "Member removed successfully" });
  } catch (err) {
    next(err);
  }
});

export default router;
