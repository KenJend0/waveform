"use client";

import { useState, useEffect } from "react";
import { useInView } from "react-intersection-observer";
import FeedCardReview from "./FeedCardReview";
import FeedCardDiary from "./FeedCardDiary";
import FeedCardLike from "./FeedCardLike";
import FeedCardFollow from "./FeedCardFollow";
import FeedCardDiscover from "./FeedCardDiscover";
import { timeAgo } from "@/lib/time";

type FeedItem = any;

export default function FeedList({ initialItems }: { initialItems: FeedItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [offset, setOffset] = useState(20);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const { ref, inView } = useInView();

  useEffect(() => {
    if (inView && hasMore && !loading) {
      loadMore();
    }
  }, [inView, hasMore, loading]);

  const loadMore = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:4000/social/feed?limit=20&offset=${offset}`, {
        credentials: "include",
      });
      const data = await res.json();

      if (data.items.length === 0) {
        setHasMore(false);
      } else {
        setItems((prev) => [...prev, ...data.items]);
        setOffset((prev) => prev + 20);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {items.map((item) => {
        const timeDisplay = timeAgo(item.created_at);
        const key = item.event_id;

        // Récupère les données de l'entrée diary si elle existe
        const diaryEntry = item.entry_id
          ? {
              review_body: item.review_body,
              rating: item.rating,
              listened_at: item.listened_at,
              likes_count: item.likes_count || 0,
              is_liked: item.is_liked || false,
            }
          : null;

        switch (item.type) {
          case "diary":
            if (diaryEntry && (diaryEntry.review_body || diaryEntry.rating)) {
              return (
                <FeedCardReview
                  key={key}
                  event_id={item.event_id}
                  created_at={item.created_at}
                  user={{
                    id: item.user_id,
                    username: item.username,
                    display_name: item.display_name,
                    avatar: item.picture_url,
                  }}
                  album={{
                    id: item.album_id,
                    title: item.album_title,
                    artist: item.artist_name,
                    cover_url: item.cover_url,
                  }}
                  rating={diaryEntry.rating}
                  review_body={diaryEntry.review_body}
                  likes_count={diaryEntry.likes_count}
                  is_liked={diaryEntry.is_liked}
                  timeDisplay={timeDisplay}
                />
              );
            } else {
              return (
                <FeedCardDiary
                  key={key}
                  user={{
                    id: item.user_id,
                    username: item.username,
                    display_name: item.display_name,
                    avatar: item.picture_url,
                  }}
                  album={{
                    id: item.album_id,
                    title: item.album_title,
                    artist: item.artist_name,
                    cover_url: item.cover_url,
                  }}
                  timeDisplay={timeDisplay}
                />
              );
            }

          case "like":
            return (
              <FeedCardLike
                key={key}
                user={{
                  id: item.user_id,
                  username: item.username,
                  display_name: item.display_name,
                  avatar: item.picture_url,
                }}
                album={
                  item.album_id
                    ? {
                        id: item.album_id,
                        title: item.album_title,
                        artist: item.artist_name,
                        cover_url: item.cover_url,
                      }
                    : undefined
                }
                timeDisplay={timeDisplay}
              />
            );

          case "follow":
            return (
              <FeedCardFollow
                key={key}
                user={{
                  id: item.user_id,
                  username: item.username,
                  display_name: item.display_name,
                  avatar: item.picture_url,
                }}
                targetUser={{
                  id: item.target_user_id,
                  username: item.target_username,
                  display_name: item.target_display_name,
                  avatar: item.target_avatar,
                }}
                timeDisplay={timeDisplay}
              />
            );

          case "discover":
            const discoverPayload =
              typeof item.payload === "string" ? JSON.parse(item.payload) : item.payload || {};
            return (
              <FeedCardDiscover
                key={key}
                album={{
                  id: item.album_id,
                  title: item.album_title,
                  artist: item.artist_name,
                  cover_url: item.cover_url,
                }}
                discover_kind={discoverPayload.discover_kind || "discover"}
              />
            );

          default:
            return null;
        }
      })}

      {hasMore && (
        <div ref={ref} className="py-8 text-center text-gray-500">
          {loading ? "Chargement..." : ""}
        </div>
      )}
    </div>
  );
}