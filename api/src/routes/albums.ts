import { Router } from 'express';
import { pool } from '../db';

const router = Router();

router.get('/:id', async (req, res) => {
    const { id } = req.params;
    const userId = (req as any).user?.id || null;

    try {
        // Album + Artist
        const { rows: albumRows } = await pool.query(
            `SELECT a.id, a.title, a.cover_url, a.release_date, a.mbid,
                    ar.id AS artist_id, ar.name AS artist_name
             FROM albums a
                      JOIN artists ar ON ar.id = a.artist_id
             WHERE a.id = $1`,
            [id]
        );
        if (albumRows.length === 0) return res.status(404).json({ error: 'album_not_found' });
        const album = albumRows[0];

        // Tracks
        const { rows: tracks } = await pool.query(
            `SELECT id, title, duration_ms, track_no, disc_no
             FROM tracks
             WHERE album_id = $1
             ORDER BY disc_no NULLS FIRST, track_no NULLS FIRST, title`,
            [id]
        );

        // Stats : nombre de reviews + note moyenne
        const { rows: statsRows } = await pool.query(
            `SELECT 
                COUNT(*)::int AS reviews_count,
                ROUND(AVG(rating), 1) AS avg_rating,
                COUNT(DISTINCT user_id)::int AS listeners_count
             FROM diary_entries
             WHERE album_id = $1`,
            [id]
        );
        const stats = statsRows[0];

        // Mon statut (ai-je déjà ajouté cet album ?)
        let myEntry = null;
        if (userId) {
            const { rows: myRows } = await pool.query(
                `SELECT id, rating, review_body, listened_at
                 FROM diary_entries
                 WHERE album_id = $1 AND user_id = $2
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [id, userId]
            );
            myEntry = myRows[0] || null;
        }

        res.json({ 
            album, 
            tracks, 
            stats: {
                reviews_count: stats.reviews_count || 0,
                avg_rating: stats.avg_rating || null,
                listeners_count: stats.listeners_count || 0,
            },
            myEntry,
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'internal_error' });
    }
});

export default router;
