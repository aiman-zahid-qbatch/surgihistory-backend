import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { AuthRequest, UserRole } from '../middlewares/auth';

interface AdminDashboardStats {
  totalUsers: number;
  totalPatients: number;
  totalSurgeries: number;
  totalFollowUps: number;
  totalModerators: number;
  totalSurgeons: number;
  pendingSurgeons: number;
  recentActivity: {
    newPatientsThisMonth: number;
    surgeriesThisMonth: number;
    followUpsThisMonth: number;
  };
  usersByRole: {
    role: string;
    count: number;
  }[];
}

class DashboardController {
  /**
   * Get admin dashboard statistics
   */
  async getAdminStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userRole = req.user?.role;

      // Only allow ADMIN to access this endpoint
      if (userRole !== UserRole.ADMIN) {
        res.status(403).json({ message: 'Access denied. Admin only.' });
        return;
      }

      // Get current date info for monthly stats
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Execute all queries in parallel for better performance
      const [
        totalUsers,
        totalPatients,
        totalSurgeries,
        totalFollowUps,
        totalModerators,
        totalSurgeons,
        pendingSurgeons,
        newPatientsThisMonth,
        surgeriesThisMonth,
        followUpsThisMonth,
        usersByRole,
      ] = await Promise.all([
        // Total users (excluding admins)
        prisma.user.count({
          where: { role: { not: 'ADMIN' } },
        }),
        // Total patients
        prisma.patient.count(),
        // Total surgeries
        prisma.surgery.count(),
        // Total follow-ups
        prisma.followUp.count(),
        // Total moderators
        prisma.moderator.count({
          where: { isArchived: false },
        }),
        // Total surgeons
        prisma.surgeon.count({
          where: { isArchived: false },
        }),
        // Pending surgeon approvals
        prisma.user.count({
          where: {
            role: 'SURGEON',
            isActive: false,
          },
        }),
        // New patients this month
        prisma.patient.count({
          where: {
            createdAt: { gte: startOfMonth },
          },
        }),
        // Surgeries this month
        prisma.surgery.count({
          where: {
            createdAt: { gte: startOfMonth },
          },
        }),
        // Follow-ups this month
        prisma.followUp.count({
          where: {
            createdAt: { gte: startOfMonth },
          },
        }),
        // Users grouped by role
        prisma.user.groupBy({
          by: ['role'],
          _count: {
            role: true,
          },
          where: {
            role: { not: 'ADMIN' },
          },
        }),
      ]);

      const stats: AdminDashboardStats = {
        totalUsers,
        totalPatients,
        totalSurgeries,
        totalFollowUps,
        totalModerators,
        totalSurgeons,
        pendingSurgeons,
        recentActivity: {
          newPatientsThisMonth,
          surgeriesThisMonth,
          followUpsThisMonth,
        },
        usersByRole: usersByRole.map((group) => ({
          role: group.role,
          count: group._count.role,
        })),
      };

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Error fetching admin dashboard stats:', error);
      next(error);
    }
  }

  /**
   * Get surgeon dashboard statistics
   */
  async getSurgeonStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      // Get surgeon profile
      const surgeon = await prisma.surgeon.findUnique({
        where: { userId },
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
      });

      if (!surgeon) {
        res.status(404).json({ message: 'Surgeon profile not found' });
        return;
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      // Execute all queries in parallel
      const [
        totalPatients,
        totalSurgeries,
        totalFollowUps,
        upcomingSurgeriesCount,
        pendingFollowUps,
        patientsThisMonth,
        surgeriesThisMonth,
        completedFollowUps,
        todaySurgeries,
        upcomingSurgeries,
        recentSurgeries,
        upcomingFollowUps,
      ] = await Promise.all([
        // Total patients created by this surgeon
        prisma.patient.count({
          where: { createdById: surgeon.id },
        }),
        // Total surgeries by this surgeon
        prisma.surgery.count({
          where: { surgeonId: surgeon.id },
        }),
        // Total follow-ups for this surgeon's patients
        prisma.followUp.count({
          where: {
            surgeonId: surgeon.id,
          },
        }),
        // Upcoming surgeries count (scheduled for future)
        prisma.surgery.count({
          where: {
            surgeonId: surgeon.id,
            surgeryDate: { gt: now },
          },
        }),
        // Pending follow-ups
        prisma.followUp.count({
          where: {
            surgeonId: surgeon.id,
            status: 'PENDING',
          },
        }),
        // New patients this month
        prisma.patient.count({
          where: {
            createdById: surgeon.id,
            createdAt: { gte: startOfMonth },
          },
        }),
        // Surgeries this month
        prisma.surgery.count({
          where: {
            surgeonId: surgeon.id,
            createdAt: { gte: startOfMonth },
          },
        }),
        // Completed follow-ups this month
        prisma.followUp.count({
          where: {
            surgeonId: surgeon.id,
            status: 'COMPLETED',
            updatedAt: { gte: startOfMonth },
          },
        }),
        // Today's surgeries with details
        prisma.surgery.findMany({
          where: {
            surgeonId: surgeon.id,
            surgeryDate: {
              gte: startOfToday,
              lte: endOfToday,
            },
          },
          include: {
            patient: {
              select: {
                id: true,
                fullName: true,
                patientId: true,
              },
            },
          },
          orderBy: { surgeryDate: 'asc' },
          take: 10,
        }),
        // Upcoming surgeries (next 7 days)
        prisma.surgery.findMany({
          where: {
            surgeonId: surgeon.id,
            surgeryDate: { gt: now },
          },
          include: {
            patient: {
              select: {
                id: true,
                fullName: true,
                patientId: true,
              },
            },
          },
          orderBy: { surgeryDate: 'asc' },
          take: 5,
        }),
        // Recent surgeries (last 5 completed)
        prisma.surgery.findMany({
          where: {
            surgeonId: surgeon.id,
            surgeryDate: { lt: now },
          },
          include: {
            patient: {
              select: {
                id: true,
                fullName: true,
                patientId: true,
              },
            },
          },
          orderBy: { surgeryDate: 'desc' },
          take: 5,
        }),
        // Upcoming follow-ups (next 5)
        prisma.followUp.findMany({
          where: {
            surgeonId: surgeon.id,
            status: 'PENDING',
            followUpDate: { gte: now },
          },
          include: {
            surgery: {
              include: {
                patient: {
                  select: {
                    id: true,
                    fullName: true,
                    patientId: true,
                  },
                },
              },
            },
          },
          orderBy: { followUpDate: 'asc' },
          take: 5,
        }),
      ]);

      res.json({
        success: true,
        data: {
          surgeon: {
            id: surgeon.id,
            fullName: surgeon.fullName,
            specialization: surgeon.specialization,
          },
          stats: {
            totalPatients,
            totalSurgeries,
            totalFollowUps,
            upcomingSurgeries: upcomingSurgeriesCount,
            pendingFollowUps,
            completedFollowUps,
          },
          recentActivity: {
            patientsThisMonth,
            surgeriesThisMonth,
          },
          todaySurgeries: todaySurgeries.map((s) => ({
            id: s.id,
            patientUuid: s.patient.id,
            patientName: s.patient.fullName,
            patientId: s.patient.patientId,
            procedureName: s.procedureName,
            diagnosis: s.diagnosis,
            surgeryDate: s.surgeryDate,
            surgeryTime: s.surgeryTime,
            surgeryRole: s.surgeryRole,
          })),
          upcomingSurgeries: upcomingSurgeries.map((s) => ({
            id: s.id,
            patientUuid: s.patient.id,
            patientName: s.patient.fullName,
            patientId: s.patient.patientId,
            procedureName: s.procedureName,
            diagnosis: s.diagnosis,
            surgeryDate: s.surgeryDate,
            surgeryTime: s.surgeryTime,
            surgeryRole: s.surgeryRole,
          })),
          recentSurgeries: recentSurgeries.map((s) => ({
            id: s.id,
            patientUuid: s.patient.id,
            patientName: s.patient.fullName,
            patientId: s.patient.patientId,
            procedureName: s.procedureName,
            diagnosis: s.diagnosis,
            surgeryDate: s.surgeryDate,
            surgeryRole: s.surgeryRole,
          })),
          upcomingFollowUps: upcomingFollowUps.map((f) => ({
            id: f.id,
            patientUuid: f.surgery.patient.id,
            patientName: f.surgery.patient.fullName,
            patientId: f.surgery.patient.patientId,
            surgeryId: f.surgeryId,
            procedureName: f.surgery.procedureName,
            followUpDate: f.followUpDate,
            scheduledTime: f.scheduledTime,
            description: f.description,
            status: f.status,
          })),
        },
      });
    } catch (error) {
      logger.error('Error fetching surgeon dashboard stats:', error);
      next(error);
    }
  }

  /**
   * Get moderator dashboard statistics
   */
  async getModeratorStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;

      // Get moderator profile
      let moderator = await prisma.moderator.findUnique({
        where: { userId },
        include: {
          user: {
            select: { name: true, email: true },
          },
        },
      });

      // Auto-create moderator profile if it doesn't exist (for existing users before profile creation code)
      if (!moderator && req.user?.role === 'MODERATOR') {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        });
        
        if (user) {
          moderator = await prisma.moderator.create({
            data: {
              userId: userId as string,
              fullName: user.name || user.email.split('@')[0],
              contactNumber: '',
            },
            include: {
              user: {
                select: { name: true, email: true },
              },
            },
          });
          logger.info(`Auto-created moderator profile for user: ${user.email}`);
        }
      }

      if (!moderator) {
        res.status(404).json({ message: 'Moderator profile not found' });
        return;
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

      // Get assigned patient IDs first (only ACCEPTED assignments)
      const assignedPatientRecords = await prisma.patientModerator.findMany({
        where: {
          moderatorId: moderator.id,
          status: 'ACCEPTED',
        },
        select: { patientId: true },
      });

      const patientIds = assignedPatientRecords.map((p) => p.patientId);

      // Execute all queries in parallel
      const [
        assignedPatients,
        pendingAssignments,
        totalSurgeries,
        totalFollowUps,
        pendingFollowUps,
        completedFollowUps,
        patientsThisMonth,
        todaySurgeries,
        upcomingSurgeries,
        recentSurgeries,
        upcomingFollowUps,
      ] = await Promise.all([
        // Total assigned patients (accepted)
        prisma.patientModerator.count({
          where: {
            moderatorId: moderator.id,
            status: 'ACCEPTED',
          },
        }),
        // Pending assignment requests
        prisma.patientModerator.count({
          where: {
            moderatorId: moderator.id,
            status: 'PENDING',
          },
        }),
        // Total surgeries for assigned patients
        patientIds.length > 0
          ? prisma.surgery.count({
              where: {
                patientId: { in: patientIds },
              },
            })
          : 0,
        // Total follow-ups for assigned patients
        patientIds.length > 0
          ? prisma.followUp.count({
              where: {
                surgery: {
                  patientId: { in: patientIds },
                },
              },
            })
          : 0,
        // Pending follow-ups
        patientIds.length > 0
          ? prisma.followUp.count({
              where: {
                surgery: {
                  patientId: { in: patientIds },
                },
                status: 'PENDING',
              },
            })
          : 0,
        // Completed follow-ups this month
        patientIds.length > 0
          ? prisma.followUp.count({
              where: {
                surgery: {
                  patientId: { in: patientIds },
                },
                status: 'COMPLETED',
                updatedAt: { gte: startOfMonth },
              },
            })
          : 0,
        // New patient assignments this month
        prisma.patientModerator.count({
          where: {
            moderatorId: moderator.id,
            status: 'ACCEPTED',
            assignedAt: { gte: startOfMonth },
          },
        }),
        // Today's surgeries for assigned patients
        patientIds.length > 0
          ? prisma.surgery.findMany({
              where: {
                patientId: { in: patientIds },
                surgeryDate: {
                  gte: startOfToday,
                  lte: endOfToday,
                },
              },
              include: {
                patient: {
                  select: {
                    id: true,
                    fullName: true,
                    patientId: true,
                  },
                },
                surgeon: {
                  select: {
                    id: true,
                    fullName: true,
                    specialization: true,
                  },
                },
              },
              orderBy: { surgeryDate: 'asc' },
              take: 10,
            })
          : [],
        // Upcoming surgeries (next 7 days)
        patientIds.length > 0
          ? prisma.surgery.findMany({
              where: {
                patientId: { in: patientIds },
                surgeryDate: { gt: now },
              },
              include: {
                patient: {
                  select: {
                    id: true,
                    fullName: true,
                    patientId: true,
                  },
                },
                surgeon: {
                  select: {
                    id: true,
                    fullName: true,
                    specialization: true,
                  },
                },
              },
              orderBy: { surgeryDate: 'asc' },
              take: 5,
            })
          : [],
        // Recent surgeries (last 5 completed)
        patientIds.length > 0
          ? prisma.surgery.findMany({
              where: {
                patientId: { in: patientIds },
                surgeryDate: { lt: now },
              },
              include: {
                patient: {
                  select: {
                    id: true,
                    fullName: true,
                    patientId: true,
                  },
                },
                surgeon: {
                  select: {
                    id: true,
                    fullName: true,
                    specialization: true,
                  },
                },
              },
              orderBy: { surgeryDate: 'desc' },
              take: 5,
            })
          : [],
        // Upcoming follow-ups (next 5)
        patientIds.length > 0
          ? prisma.followUp.findMany({
              where: {
                surgery: {
                  patientId: { in: patientIds },
                },
                status: 'PENDING',
                followUpDate: { gte: now },
              },
              include: {
                surgery: {
                  include: {
                    patient: {
                      select: {
                        id: true,
                        fullName: true,
                        patientId: true,
                      },
                    },
                  },
                },
                surgeon: {
                  select: {
                    id: true,
                    fullName: true,
                  },
                },
              },
              orderBy: { followUpDate: 'asc' },
              take: 5,
            })
          : [],
      ]);

      res.json({
        success: true,
        data: {
          moderator: {
            id: moderator.id,
            fullName: moderator.fullName,
          },
          stats: {
            assignedPatients,
            totalSurgeries,
            totalFollowUps,
            pendingAssignments,
            pendingFollowUps,
            completedFollowUps,
          },
          recentActivity: {
            patientsThisMonth,
          },
          todaySurgeries: todaySurgeries.map((s) => ({
            id: s.id,
            patientUuid: s.patient.id,
            patientName: s.patient.fullName,
            patientId: s.patient.patientId,
            procedureName: s.procedureName,
            diagnosis: s.diagnosis,
            surgeryDate: s.surgeryDate,
            surgeryTime: s.surgeryTime,
            surgeonName: s.surgeon.fullName,
            surgeonSpecialization: s.surgeon.specialization,
          })),
          upcomingSurgeries: upcomingSurgeries.map((s) => ({
            id: s.id,
            patientUuid: s.patient.id,
            patientName: s.patient.fullName,
            patientId: s.patient.patientId,
            procedureName: s.procedureName,
            diagnosis: s.diagnosis,
            surgeryDate: s.surgeryDate,
            surgeryTime: s.surgeryTime,
            surgeonName: s.surgeon.fullName,
            surgeonSpecialization: s.surgeon.specialization,
          })),
          recentSurgeries: recentSurgeries.map((s) => ({
            id: s.id,
            patientUuid: s.patient.id,
            patientName: s.patient.fullName,
            patientId: s.patient.patientId,
            procedureName: s.procedureName,
            diagnosis: s.diagnosis,
            surgeryDate: s.surgeryDate,
            surgeonName: s.surgeon.fullName,
          })),
          upcomingFollowUps: upcomingFollowUps.map((f) => ({
            id: f.id,
            patientUuid: f.surgery.patient.id,
            patientName: f.surgery.patient.fullName,
            patientId: f.surgery.patient.patientId,
            surgeryId: f.surgeryId,
            procedureName: f.surgery.procedureName,
            followUpDate: f.followUpDate,
            scheduledTime: f.scheduledTime,
            description: f.description,
            status: f.status,
            surgeonName: f.surgeon?.fullName,
          })),
        },
      });
    } catch (error) {
      logger.error('Error fetching moderator dashboard stats:', error);
      next(error);
    }
  }
}

export const dashboardController = new DashboardController();
