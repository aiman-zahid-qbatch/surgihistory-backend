import { PrismaClient } from '@prisma/client';
import { logger } from '../config/logger';

const prisma = new PrismaClient();

interface CreatePrivateNoteData {
  doctorId: string;
  followUpId?: string;
  surgeryId?: string;
  title?: string;
  content: string;
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
   * Create a new private note (doctor-only)
   */
  async createPrivateNote(data: CreatePrivateNoteData) {
    try {
      const note = await prisma.privateNote.create({
        data: {
          doctorId: data.doctorId,
          followUpId: data.followUpId,
          surgeryId: data.surgeryId,
          title: data.title,
          content: data.content,
          audioUrl: data.audioUrl,
          audioDuration: data.audioDuration,
          hasTranscription: data.hasTranscription || false,
          transcriptionText: data.transcriptionText,
          attachments: data.attachments,
        },
        include: {
          doctor: {
            select: {
              id: true,
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

      logger.info(`Private note created: ${note.id} by doctor: ${data.doctorId}`);
      return note;
    } catch (error) {
      logger.error('Error creating private note:', error);
      throw error;
    }
  }

  /**
   * Get private note by ID
   * Ensures only the doctor who created it can access
   */
  async getPrivateNoteById(id: string, doctorId: string) {
    try {
      const note = await prisma.privateNote.findFirst({
        where: {
          id,
          doctorId, // Security: Only the doctor who created it can access
          isArchived: false,
        },
        include: {
          doctor: {
            select: {
              id: true,
              fullName: true,
            },
          },
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
   * Get all private notes for a doctor
   */
  async getPrivateNotesByDoctor(doctorId: string) {
    try {
      const notes = await prisma.privateNote.findMany({
        where: {
          doctorId,
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
      logger.error(`Error fetching private notes for doctor ${doctorId}:`, error);
      throw error;
    }
  }

  /**
   * Get private notes for a specific follow-up
   */
  async getPrivateNotesByFollowUp(followUpId: string, doctorId: string) {
    try {
      const notes = await prisma.privateNote.findMany({
        where: {
          followUpId,
          doctorId, // Security: Only the doctor's own notes
          isArchived: false,
        },
        include: {
          doctor: {
            select: {
              id: true,
              fullName: true,
            },
          },
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
   */
  async getPrivateNotesBySurgery(surgeryId: string, doctorId: string) {
    try {
      const notes = await prisma.privateNote.findMany({
        where: {
          surgeryId,
          doctorId, // Security: Only the doctor's own notes
          isArchived: false,
        },
        include: {
          doctor: {
            select: {
              id: true,
              fullName: true,
            },
          },
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
   * Update private note
   * Only the doctor who created it can update
   */
  async updatePrivateNote(id: string, doctorId: string, data: UpdatePrivateNoteData) {
    try {
      const note = await prisma.privateNote.update({
        where: {
          id,
          doctorId, // Security: Only the doctor who created it can update
        },
        data,
        include: {
          doctor: {
            select: {
              id: true,
              fullName: true,
            },
          },
          followUp: {
            select: {
              id: true,
              followUpDate: true,
            },
          },
        },
      });

      logger.info(`Private note updated: ${id} by doctor: ${doctorId}`);
      return note;
    } catch (error) {
      logger.error(`Error updating private note ${id}:`, error);
      throw error;
    }
  }

  /**
   * Add audio transcription to private note
   */
  async addTranscription(id: string, doctorId: string, transcriptionText: string) {
    try {
      const note = await prisma.privateNote.update({
        where: {
          id,
          doctorId,
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
   * Only the doctor who created it can archive
   */
  async archivePrivateNote(id: string, doctorId: string) {
    try {
      const note = await prisma.privateNote.update({
        where: {
          id,
          doctorId, // Security: Only the doctor who created it can archive
        },
        data: {
          isArchived: true,
          archivedAt: new Date(),
        },
      });

      logger.info(`Private note archived: ${id} by doctor: ${doctorId}`);
      return note;
    } catch (error) {
      logger.error(`Error archiving private note ${id}:`, error);
      throw error;
    }
  }

  /**
   * Search private notes (only for the specified doctor)
   */
  async searchPrivateNotes(query: string, doctorId: string) {
    try {
      const notes = await prisma.privateNote.findMany({
        where: {
          doctorId,
          isArchived: false,
          OR: [
            {
              title: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              content: {
                contains: query,
                mode: 'insensitive',
              },
            },
            {
              transcriptionText: {
                contains: query,
                mode: 'insensitive',
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
   * Get private note count for a doctor
   */
  async getPrivateNoteCount(doctorId: string) {
    try {
      const count = await prisma.privateNote.count({
        where: {
          doctorId,
          isArchived: false,
        },
      });

      return count;
    } catch (error) {
      logger.error(`Error getting private note count for doctor ${doctorId}:`, error);
      throw error;
    }
  }
}

export default new PrivateNoteService();
