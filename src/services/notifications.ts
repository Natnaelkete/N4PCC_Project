import { query } from '../db/connection.js';
import { logger } from '../utils/logger.js';

export const createNotification = async (
  recipientId: string,
  title: string,
  body: string,
  relatedEntityId?: string,
  relatedEntityType?: string,
): Promise<void> => {
  await query(
    `INSERT INTO notifications (recipient_id, title, body, related_entity_id, related_entity_type)
     VALUES ($1, $2, $3, $4, $5)`,
    [recipientId, title, body, relatedEntityId, relatedEntityType],
  );

  logger.info('Notification created', {
    userId: recipientId,
    action: 'NOTIFICATION_CREATED',
    details: { title, relatedEntityId, relatedEntityType },
  });
};

export const markNotificationAsSeen = async (userId: string, notificationId: string): Promise<void> => {
  await query(
    `UPDATE notifications SET status = 'SEEN', seen_at = NOW() WHERE id = $1 AND recipient_id = $2`,
    [notificationId, userId],
  );
};

export const getNotifications = async (userId: string, limit = 50): Promise<any[]> => {
  const result = await query(
    `SELECT * FROM notifications WHERE recipient_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, limit],
  );
  return result.rows;
};

export const getUnseenNotifications = async (userId: string): Promise<any[]> => {
  const result = await query(
    `SELECT * FROM notifications WHERE recipient_id = $1 AND status = 'DELIVERED' ORDER BY created_at DESC`,
    [userId],
  );
  return result.rows;
};



