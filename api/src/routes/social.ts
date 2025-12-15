import { Router } from 'express';
import { pool } from '../db';
import { requireAuth } from '../middleware/requireAuth';
import { requireAuthOptional } from '../middleware/requireAuthOptional';

const router = Router();

// Helper pour détecter un UUID
function isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(str);
}

/* =================== FOLLOW =================== */
// POST /social/follow/:idOrUsername  → toggle follow/unfollow
router.post('/follow/:idOrUsername', requireAuth, async (req, res) => {
    const me = (req as any).user;
    const key = req.params.idOrUsername;

    try {
        // Chercher l'utilisateur cible
        const query = isUUID(key)
            ? `SELECT id FROM users WHERE id = $1`
            : `SELECT id FROM users WHERE username = $1`;
        const { rows } = await pool.query(query, [key]);
        if (rows.length === 0) return res.status(404).json({ error: 'user_not_found' });

        const targetId = rows[0].id;
        if (me.id === targetId) return res.status(400).json({ error: 'cannot_follow_self' });

        // Vérifie si déjà abonné
        const link = await pool.query(
            `SELECT 1 FROM follows WHERE follower_id=$1 AND followee_id=$2`,
            [me.id, targetId]
        );

        if (link.rows.length > 0) {
            await pool.query(`DELETE FROM follows WHERE follower_id=$1 AND followee_id=$2`, [me.id, targetId]);
            return res.json({ following: false });
        } else {
            await pool.query(
                `INSERT INTO follows (follower_id, followee_id, created_at)
                 VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
                [me.id, targetId]
            );
            return res.json({ following: true });
        }
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'follow_toggle_failed' });
    }
});

// GET /social/users/:idOrUsername/followers
router.get('/users/:idOrUsername/followers', requireAuthOptional, async (req, res) => {
    const key = req.params.idOrUsername;
    const viewerId = (req as any).user?.id ?? null;

    try {
        const userQ = isUUID(key)
            ? `SELECT id FROM users WHERE id = $1`
            : `SELECT id FROM users WHERE username = $1`;
        const { rows: u } = await pool.query(userQ, [key]);
        if (u.length === 0) return res.status(404).json({ error: 'user_not_found' });

        const userId = u[0].id;

        const { rows: followers } = await pool.query(
            `
                SELECT
                    u.id, u.display_name, u.username, u.picture_url, f.created_at,
                    (u.id = $2) AS is_me,
                    (fx.is_following IS TRUE) AS is_following
                FROM follows f
                         JOIN users u ON u.id = f.follower_id
                         LEFT JOIN LATERAL (
                    SELECT true AS is_following
                    FROM follows fx
                    WHERE fx.follower_id = $2 AND fx.followee_id = u.id
                        LIMIT 1
      ) fx ON TRUE
                WHERE f.followee_id = $1
                ORDER BY f.created_at DESC
                    LIMIT 200
            `,
            [userId, viewerId]
        );

        const { rows: countRows } = await pool.query(
            `SELECT COUNT(*)::int AS count FROM follows WHERE followee_id = $1`,
            [userId]
        );

        res.json({ count: countRows[0].count, items: followers });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'followers_failed' });
    }
});

// GET /social/users/:idOrUsername/following
router.get('/users/:idOrUsername/following', requireAuthOptional, async (req, res) => {
    const key = req.params.idOrUsername;
    const viewerId = (req as any).user?.id ?? null;

    try {
        const userQ = isUUID(key)
            ? `SELECT id FROM users WHERE id = $1`
            : `SELECT id FROM users WHERE username = $1`;
        const { rows: u } = await pool.query(userQ, [key]);
        if (u.length === 0) return res.status(404).json({ error: 'user_not_found' });

        const userId = u[0].id;

        const { rows: following } = await pool.query(
            `
                SELECT
                    u.id, u.display_name, u.username, u.picture_url, f.created_at,
                    (u.id = $2) AS is_me,
                    (fx.is_following IS TRUE) AS is_following
                FROM follows f
                         JOIN users u ON u.id = f.followee_id
                         LEFT JOIN LATERAL (
                    SELECT true AS is_following
                    FROM follows fx
                    WHERE fx.follower_id = $2 AND fx.followee_id = u.id
                        LIMIT 1
      ) fx ON TRUE
                WHERE f.follower_id = $1
                ORDER BY f.created_at DESC
                    LIMIT 200
            `,
            [userId, viewerId]
        );

        const { rows: countRows } = await pool.query(
            `SELECT COUNT(*)::int AS count FROM follows WHERE follower_id = $1`,
            [userId]
        );

        res.json({ count: countRows[0].count, items: following });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'following_failed' });
    }
});

/* =================== LIKES =================== */
// POST /social/diary/:entryId/like
router.post('/diary/:entryId/like', requireAuth, async (req, res) => {
    const me = (req as any).user;
    const entryId = req.params.entryId;

    try {
        await pool.query(
            `INSERT INTO diary_likes (user_id, entry_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [me.id, entryId]
        );

        const { rows } = await pool.query(
            `SELECT COUNT(*)::int AS likes_count FROM diary_likes WHERE entry_id=$1`,
            [entryId]
        );

        res.json({ liked: true, likes_count: rows[0].likes_count });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'like_failed' });
    }
});

// DELETE /social/diary/:entryId/like
router.delete('/diary/:entryId/like', requireAuth, async (req, res) => {
    const me = (req as any).user;
    const entryId = req.params.entryId;

    try {
        await pool.query(
            `DELETE FROM diary_likes WHERE user_id=$1 AND entry_id=$2`,
            [me.id, entryId]
        );

        const { rows } = await pool.query(
            `SELECT COUNT(*)::int AS likes_count FROM diary_likes WHERE entry_id=$1`,
            [entryId]
        );

        res.json({ liked: false, likes_count: rows[0].likes_count });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'unlike_failed' });
    }
});


/* =================== COMMENTS =================== */
router.post('/diary/:entryId/comments', requireAuth, async (req, res) => {
    const me = (req as any).user;
    const entryId = req.params.entryId;
    const body = String((req.body?.body ?? '')).trim();
    if (!body) return res.status(400).json({ error: 'empty_comment' });

    try {
        const ent = await pool.query(
            `SELECT user_id, is_public FROM diary_entries WHERE id=$1`,
            [entryId]
        );
        if (ent.rowCount === 0) return res.status(404).json({ error: 'entry_not_found' });
        const { user_id, is_public } = ent.rows[0];
        if (user_id !== me.id && !is_public) return res.status(403).json({ error: 'forbidden' });

        const { rows } = await pool.query(
            `INSERT INTO diary_comments (entry_id, user_id, body)
             VALUES ($1, $2, $3)
                 RETURNING id, entry_id, user_id, body, created_at, updated_at`,
            [entryId, me.id, body]
        );
        res.json({ ok: true, comment: rows[0] });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'comment_failed' });
    }
});

router.get('/diary/:entryId/comments', async (req, res) => {
    const entryId = req.params.entryId;
    try {
        const { rows } = await pool.query(
            `SELECT c.id, c.body, c.created_at, c.updated_at,
                    u.id AS user_id, u.display_name, u.picture_url
             FROM diary_comments c
                      JOIN users u ON u.id = c.user_id
             WHERE c.entry_id = $1
             ORDER BY c.created_at ASC
                 LIMIT 200`,
            [entryId]
        );
        res.json({ items: rows });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'comments_list_failed' });
    }
});

/* =================== FEED =================== */
router.get('/feed', requireAuthOptional, async (req, res) => {
    const me = (req as any).user;
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const offset = Number(req.query.offset ?? 0);

    try {
        if (!me) {
            // pas connecté → renvoyer juste des Discover
            const { rows } = await pool.query(
                `
                SELECT fe.event_id, fe.type, fe.created_at, fe.payload,
                       fe.user_id, NULL::uuid AS target_user_id,
                       fe.album_id, NULL::uuid AS entry_id,
                       u.display_name, u.username, u.picture_url,
                       a.title AS album_title, ar.name AS artist_name, a.cover_url
                FROM feed_events fe
                LEFT JOIN users u ON u.id = fe.user_id
                LEFT JOIN albums a ON a.id = fe.album_id
                LEFT JOIN artists ar ON ar.id = a.artist_id
                WHERE fe.type = 'discover'
                ORDER BY fe.created_at DESC
                LIMIT $1 OFFSET $2
                `,
                [limit, offset]
            );

            return res.json({ items: rows });
        }

        // connecté → feed complet
        const { rows } = await pool.query(
            `
                SELECT fe.event_id, fe.type, fe.created_at, fe.payload,
                       fe.user_id, NULL::uuid AS target_user_id,
                       fe.album_id,
                       -- Récupérer entry_id depuis le payload JSON
                       (fe.payload->>'entry_id')::uuid AS entry_id,
                       u.display_name, u.username, u.picture_url,
                       a.title AS album_title, ar.name AS artist_name, a.cover_url,
                       de.review_body, de.rating, de.listened_at,
                       (SELECT COUNT(*)::int FROM diary_likes WHERE entry_id = de.id) AS likes_count,
                       EXISTS(SELECT 1 FROM diary_likes WHERE entry_id = de.id AND user_id = $1) AS is_liked
                FROM feed_events fe
                LEFT JOIN users u ON u.id = fe.user_id
                LEFT JOIN albums a ON a.id = fe.album_id
                LEFT JOIN artists ar ON ar.id = a.artist_id
                LEFT JOIN diary_entries de ON de.id = (fe.payload->>'entry_id')::uuid
                WHERE fe.user_id = $1
                   OR fe.user_id IN (SELECT followee_id FROM follows WHERE follower_id = $1)
                   OR fe.type = 'discover'
                ORDER BY fe.created_at DESC
                LIMIT $2 OFFSET $3
            `,
            [me.id, limit, offset]
        );

        res.json({ items: rows });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'feed_failed' });
    }
});

// PATCH /social/diary/:entryId/comments/:commentId
router.patch('/diary/:entryId/comments/:commentId', requireAuth, async (req, res) => {
    const me = (req as any).user;
    const { entryId, commentId } = req.params;
    const body = String((req.body?.body ?? '')).trim();
    if (!body) return res.status(400).json({ error: 'empty_comment' });

    try {
        const check = await pool.query(
            `SELECT user_id FROM diary_comments WHERE id=$1 AND entry_id=$2`,
            [commentId, entryId]
        );
        if (check.rowCount === 0) return res.status(404).json({ error: 'not_found' });
        if (check.rows[0].user_id !== me.id)
            return res.status(403).json({ error: 'forbidden' });

        const { rows } = await pool.query(
            `UPDATE diary_comments
             SET body=$1, updated_at=NOW()
             WHERE id=$2
             RETURNING id, entry_id, user_id, body, created_at, updated_at`,
            [body, commentId]
        );

        res.json({ ok: true, comment: rows[0] });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'comment_update_failed' });
    }
});

// DELETE /social/diary/:entryId/comments/:commentId
router.delete('/diary/:entryId/comments/:commentId', requireAuth, async (req, res) => {
    const me = (req as any).user;
    const { entryId, commentId } = req.params;

    try {
        const check = await pool.query(
            `SELECT user_id FROM diary_comments WHERE id=$1 AND entry_id=$2`,
            [commentId, entryId]
        );
        if (check.rowCount === 0) return res.status(404).json({ error: 'not_found' });
        if (check.rows[0].user_id !== me.id)
            return res.status(403).json({ error: 'forbidden' });

        await pool.query(`DELETE FROM diary_comments WHERE id=$1`, [commentId]);

        res.json({ ok: true });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'comment_delete_failed' });
    }
});

router.get("/discover/active", async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT d.id, d.discover_kind, d.album_id, d.score,
                   a.title AS album_title, ar.name AS artist_name, a.cover_url
            FROM discover_items d
                     JOIN albums a ON a.id = d.album_id
                     JOIN artists ar ON ar.id = a.artist_id
            WHERE d.starts_at <= NOW() AND d.ends_at >= NOW()
            ORDER BY d.starts_at DESC;
        `);

        // Si aucun discover actif → renvoyer les derniers créés
        if (rows.length === 0) {
            const { rows: fallback } = await pool.query(`
        SELECT d.id, d.discover_kind, d.album_id, d.score,
               a.title AS album_title, ar.name AS artist_name, a.cover_url
        FROM discover_items d
        JOIN albums a ON a.id = d.album_id
        JOIN artists ar ON ar.id = a.artist_id
        ORDER BY d.created_at DESC
        LIMIT 10;
      `);
            return res.json(fallback);
        }

        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "discover_fetch_failed" });
    }
});


export default router;
