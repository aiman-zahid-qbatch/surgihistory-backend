import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

interface CreatePrivateNoteData {
  patientId: string;
  followUpId?: string;
  surgeryId?: string;
  title?: string;
  content: string;
  createdBy: string; // ID of the moderator who created this note
  createdByRole: string; // Role of the creator
  createdByName: string; // Name of the creator
  audioUrl?: string;
  audioDuration?: number;
  hasTranscription?: boolean;
  transcriptionText?: string;
  attachments?: any; // JSON array
}

interface UpdatePrivateNoteData {
  title?: string;
  content?: string;
  audioUrl?: string;
  audioDuration?: number;
  hasTranscription?: boolean;
  transcriptionText?: string;
  attachments?: any;
}

export class PrivateNoteService {
  /**
   * Create a new private note (accessible by doctors, surgeons, and moderators)
   */
  async createPrivateNote(data: CreatePrivateNoteData) {
    try {
      const note = await prisma.privateNote.create({
        data: {
          patientId: data.patientId,
          followUpId: data.followUpId,
          surgeryId: data.surgeryId,
          title: data.title,
          content: data.content,
          createdBy: data.createdBy,
          createdByRole: data.createdByRole,
          createdByName: data.createdByName,
          audioUrl: data.audioUrl,
          audioDuration: data.audioDuration,
          hasTranscription: data.hasTranscription || false,
          transcriptionText: data.transcriptionText,
          attachments: data.attachments,
        },
        include: {
          patient: {
            select: {
              id: true,
              patientId: true,
              fullName: true,
            },
          },
          followUp: {
            select: {
              id: true,
              followUpDate: true,
              surgery: {
                select: {
                  patient: {
                    select: {
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      logger.info(`Private note created: ${note.id} by ${data.createdByRole}: ${data.createdByName}`);
      return note;
    } catch (error) {
      logger.error('Error creating private note:', error);
      throw error;
    }
  }

  /**
   * Get private note by ID
   * Accessible by all moderators and surgeons
   */
  async getPrivateNoteById(id: string) {
    try {
      const note = await prisma.privateNote.findFirst({
        where: {
          id,
          isArchived: false,
        },
        include: {
          followUp: {
            select: {
              id: true,
              followUpDate: true,
              description: true,
              surgery: {
                select: {
                  id: true,
                  diagnosis: true,
                  patient: {
                    select: {
                      fullName: true,
                      patientId: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      return note;
    } catch (error) {
      logger.error(`Error fetching private note ${id}:`, error);
      throw error;
    }
  }

  /**
   * Get all private notes (accessible by all moderators and surgeons)
   */
  async getAllPrivateNotes() {
    try {
      const notes = await prisma.privateNote.findMany({
        where: {
          isArchived: false,
        },
        include: {
          followUp: {
            select: {
              id: true,
              followUpDate: true,
              surgery: {
                select: {
                  patient: {
                    select: {
                      fullName: true,
                      patientId: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return notes;
    } catch (error) {
      logger.error('Error fetching all private notes:', error);
      throw error;
    }
  }

  /**
   * Get private notes for a specific follow-up
   * Accessible by all moderators and surgeons
   */
  async getPrivateNotesByFollowUp(followUpId: string) {
    try {
      const notes = await prisma.privateNote.findMany({
        where: {
          followUpId,
          isArchived: false,
        },
        orderBy: { createdAt: 'desc' },
      });

      return notes;
    } catch (error) {
      logger.error(`Error fetching private notes for follow-up ${followUpId}:`, error);
      throw error;
    }
  }

  /**
   * Get private notes for a specific surgery
   * Accessible by all moderators and surgeons
   */
  async getPrivateNotesBySurgery(surgeryId: string) {
    try {
      const notes = await prisma.privateNote.findMany({
        where: {
          surgeryId,
          isArchived: false,
        },
        orderBy: { createdAt: 'desc' },
      });

      return notes;
    } catch (error) {
      logger.error(`Error fetching private notes for surgery ${surgeryId}:`, error);
      throw error;
    }
  }

  /**
   * Get private notes for a specific patient
   * Accessible by all moderators and surgeons
   */
  async getPrivateNotesByPatient(patientId: string) {
    try {
      const notes = await prisma.privateNote.findMany({
        where: {
          patientId,
          isArchived: false,
        },
        include: {
          patient: {
            select: {
              id: true,
              patientId: true,
              fullName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return notes;
    } catch (error) {
      logger.error(`Error fetching private notes for patient ${patientId}:`, error);
      throw error;
    }
  }

  /**
   * Update private note
   * Only the creator (moderator/surgeon) who created it can update
   */
  async updatePrivateNote(id: string, createdBy: string, data: UpdatePrivateNoteData) {
    try {
      const note = await prisma.privateNote.update({
        where: {
          id,
          createdBy, // Security: Only the creator can update
        },
        data,
        include: {
          followUp: {
            select: {
              id: true,
              followUpDate: true,
            },
          },
        },
      });

      logger.info(`Private note updated: ${id} by creator: ${createdBy}`);
      return note;
    } catch (error) {
      logger.error(`Error updating private note ${id}:`, error);
      throw error;
    }
  }

  /**
   * Add audio transcription to private note
   * Only the creator can add transcription
   */
  async addTranscription(id: string, createdBy: string, transcriptionText: string) {
    try {
      const note = await prisma.privateNote.update({
        where: {
          id,
          createdBy,
        },
        data: {
          hasTranscription: true,
          transcriptionText,
        },
      });

      logger.info(`Transcription added to private note: ${id}`);
      return note;
    } catch (error) {
      logger.error(`Error adding transcription to private note ${id}:`, error);
      throw error;
    }
  }

  /**
   * Archive private note (soft delete)
   * Only the creator (moderator/surgeon) who created it can archive
   */
  async archivePrivateNote(id: string, createdBy: string) {
    try {
      const note = await prisma.privateNote.update({
        where: {
          id,
          createdBy, // Security: Only the creator can archive
        },
        data: {
          isArchived: true,
          archivedAt: new Date(),
        },
      });

      logger.info(`Private note archived: ${id} by creator: ${createdBy}`);
      return note;
    } catch (error) {
      logger.error(`Error archiving private note ${id}:`, error);
      throw error;
    }
  }

  /**
   * Search private notes (accessible by all moderators and surgeons)
   */
  async searchPrivateNotes(query: string) {
    try {
      const notes = await prisma.privateNote.findMany({
        where: {
          isArchived: false,
          OR: [
            {
              title: {
                contains: query,
              },
            },
            {
              content: {
                contains: query,
              },
            },
            {
              transcriptionText: {
                contains: query,
              },
            },
          ],
        },
        include: {
          followUp: {
            select: {
              id: true,
              followUpDate: true,
              surgery: {
                select: {
                  patient: {
                    select: {
                      fullName: true,
                      patientId: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      return notes;
    } catch (error) {
      logger.error('Error searching private notes:', error);
      throw error;
    }
  }

  /**
   * Get total private note count (accessible by all moderators and surgeons)
   */
  async getPrivateNoteCount() {
    try {
      const count = await prisma.privateNote.count({
        where: {
          isArchived: false,
        },
      });

      return count;
    } catch (error) {
      logger.error('Error getting private note count:', error);
      throw error;
    }
  }
}

export default new PrivateNoteService();
