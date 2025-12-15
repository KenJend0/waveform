"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import NotificationCard from "@/components/NotificationCard";
import { timeAgo } from "@/lib/time";

/* =================== TYPES =================== */
type Notification = {
  id: string;
  type: "like" | "follow" | "comment" | "mention" | "reply";
  actor_id: string;
  actor_display_name?: string;
  actor_username?: string;
  actor_avatar?: string;
  target_user_id?: string;
  target_display_name?: string;
  target_username?: string;
  target_album_id?: string;
  album_title?: string;
  album_cover?: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  /* =================== STATE =================== */
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const didFetch = useRef(false);
  const loadedIds = useRef(new Set<string>());  // ← Tracker les IDs déjà chargés

  /* =================== EFFECT =================== */
  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;
    loadNotifications();
  }, []);

  /* =================== LOAD =================== */
  const loadNotifications = async () => {
    console.log("🔄 loadNotifications called with offset =", offset);
    setLoading(true);

    try {
      const res = await fetch(
        `http://localhost:4000/notifications?limit=20&offset=${offset}`,
        { credentials: "include" }
      );

      if (!res.ok) throw new Error("Failed to fetch notifications");

      const data = await res.json();
      console.log(
        "📦 received items:",
        data.items.map((n: Notification) => n.id)
      );

      if (data.items.length === 0) {
        setHasMore(false);
      } else {
        // Filtrer les IDs déjà chargés
        const newItems = data.items.filter((item: Notification) => {
          if (loadedIds.current.has(item.id)) {
            console.log("⚠️ Skipping duplicate:", item.id);
            return false;
          }
          loadedIds.current.add(item.id);
          return true;
        });

        if (newItems.length > 0) {
          setNotifications((prev) => [...prev, ...newItems]);
          setOffset((prev) => prev + 20);
        }
      }
    } catch (e) {
      console.error("❌ loadNotifications error:", e);
    } finally {
      setLoading(false);
    }
  };

  /* =================== ACTIONS =================== */
  const markAsRead = async (id: string) => {
    try {
      await fetch(`http://localhost:4000/notifications/${id}/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_read: true }),
      });

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
    } catch (e) {
      console.error(e);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch(`http://localhost:4000/notifications/read/all`, {
        method: "PATCH",
        credentials: "include",
      });

      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch (e) {
      console.error(e);
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await fetch(`http://localhost:4000/notifications/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  /* =================== RENDER =================== */
  return (
    <main className="p-6 pb-20 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Notifications</h1>
        {notifications.length > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-sm text-emerald-400 hover:text-emerald-300 transition"
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Loading */}
      {loading && notifications.length === 0 && (
        <div className="text-center text-gray-500 py-12">Chargement...</div>
      )}

      {/* Empty State */}
      {!loading && notifications.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-gray-500 py-12"
        >
          <p className="text-lg">Aucune notification pour le moment</p>
          <p className="text-sm">Vos notifications apparaîtront ici</p>
        </motion.div>
      )}

      {/* Notifications List */}
      {notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((notif, idx) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <NotificationCard
                {...notif}
                timeDisplay={timeAgo(notif.created_at)}
                onMarkAsRead={() => markAsRead(notif.id)}
                onDelete={() => deleteNotification(notif.id)}
              />
            </motion.div>
          ))}
        </div>
      )}

      {/* Load More */}
      {hasMore && notifications.length > 0 && (
        <button
          onClick={loadNotifications}
          disabled={loading}
          className="w-full mt-6 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition disabled:opacity-50"
        >
          {loading ? "Chargement..." : "Charger plus"}
        </button>
      )}
    </main>
  );
}