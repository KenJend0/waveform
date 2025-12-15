import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { requireAuth } from '../middleware/requireAuth';

const router = Router();

/* =================== GET NOTIFICATIONS =================== */
router.get('/', requireAuth, async (req, res) => {

    const test = await pool.query("SELECT COUNT(*) FROM notifications");
    console.log("🔎 notifications count (API DB):", test.rows[0].count);


    const userId = (req as any).user.id;
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const offset = Number(req.query.offset ?? 0);

    try {
        const { rows } = await pool.query(
            `
            SELECT 
                n.id,
                n.type,
                n.actor_id,
                n.target_user_id,
                n.target_album_id,
                n.target_entry_id,
                n.message,
                n.is_read,
                n.created_at,
                -- Actor info
                u.display_name AS actor_display_name,
                u.username AS actor_username,
                u.picture_url AS actor_avatar,
                -- Album info (si applicable)
                a.title AS album_title,
                a.cover_url AS album_cover,
                -- Target user info (si applicable)
                tu.display_name AS target_display_name,
                tu.username AS target_username
            FROM notifications n
            LEFT JOIN users u ON u.id = n.actor_id
            LEFT JOIN albums a ON a.id = n.target_album_id
            LEFT JOIN users tu ON tu.id = n.target_user_id
            WHERE n.user_id = $1
            ORDER BY n.created_at DESC
            LIMIT $2 OFFSET $3
            `,
            [userId, limit, offset]
        );

        res.json({ items: rows });
        
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'fetch_notifications_failed' });
    }
});

/* =================== GET UNREAD COUNT =================== */
router.get('/unread/count', requireAuth, async (req, res) => {
    const userId = (req as any).user.id;

    try {
        const { rows } = await pool.query(
            `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false`,
            [userId]
        );

        res.json({ unread_count: rows[0]?.count || 0 });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'count_failed' });
    }
});

/* =================== MARK AS READ =================== */
router.patch('/:id/read', requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const { id } = req.params;

    const schema = z.object({ is_read: z.boolean() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    try {
        const { rowCount } = await pool.query(
            `UPDATE notifications SET is_read = $1 WHERE id = $2 AND user_id = $3`,
            [parsed.data.is_read, id, userId]
        );

        if (rowCount === 0) {
            return res.status(404).json({ error: 'notification_not_found' });
        }

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'update_failed' });
    }
});

/* =================== MARK ALL AS READ =================== */
router.patch('/read/all', requireAuth, async (req, res) => {
    const userId = (req as any).user.id;

    try {
        await pool.query(
            `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
            [userId]
        );

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'update_failed' });
    }
});

/* =================== DELETE NOTIFICATION =================== */
router.delete('/:id', requireAuth, async (req, res) => {
    const userId = (req as any).user.id;
    const { id } = req.params;

    try {
        const { rowCount } = await pool.query(
            `DELETE FROM notifications WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );

        if (rowCount === 0) {
            return res.status(404).json({ error: 'notification_not_found' });
        }

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'delete_failed' });
    }
});

/* =================== DELETE ALL NOTIFICATIONS =================== */
router.delete('/', requireAuth, async (req, res) => {
    const userId = (req as any).user.id;

    try {
        await pool.query(
            `DELETE FROM notifications WHERE user_id = $1`,
            [userId]
        );

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'delete_failed' });
    }
});

export default router;