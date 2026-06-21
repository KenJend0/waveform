'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, Trash2, CornerDownLeft, Flag, Share2, Link2, MoreHorizontal, Edit2 } from 'lucide-react';
import { showToast } from '@/components/Toast';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import BackButton from '@/components/BackButton';
import EditTrackDiaryEntryButton from '@/components/EditTrackDiaryEntryButton';
import LikesBottomSheet from '@/components/LikesBottomSheet';
import { useAuth } from '@/lib/AuthContext';
import {
  toggleTrackDiaryLike,
  addTrackComment,
  deleteTrackComment,
  getTrackEntryComments,
  type TrackDiaryEntryDetail,
  type TrackDiaryComment,
} from '@/app/actions/track-diary';
import { reportContent } from '@/app/actions/moderation';

function relativeTime(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} jours`;
  if (days < 30) return `il y a ${Math.floor(days / 7)} sem.`;
  if (days < 365) return `il y a ${Math.floor(days / 30)} mois`;
  return `il y a ${Math.floor(days / 365)} an${Math.floor(days / 365) > 1 ? 's' : ''}`;
}

function shortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

function MoreMenu({ onShare, onCopyLink, onReport, onEdit, onDelete, isAuthor }: {
  onShare: () => void;
  onCopyLink: () => void;
  onReport?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isAuthor: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="p-1.5 rounded-[6px] text-text-tertiary hover:text-accent hover:bg-background-secondary transition-colors"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-48 bg-[#FAF8F4] border border-[#D8D3CB] rounded-[10px] shadow-[0_4px_12px_-4px_rgba(60,40,20,0.14)] z-50 py-1.5 overflow-hidden">
          <p className="text-[9px] uppercase tracking-[0.22em] text-text-disabled px-3 pt-1.5 pb-1">Options</p>
          <button onClick={() => { onShare(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-primary hover:bg-[#ECE8E1] transition-colors text-left">
            <Share2 size={13} className="text-text-secondary flex-shrink-0" />
            Partager
          </button>
          <button onClick={() => { onCopyLink(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-primary hover:bg-[#ECE8E1] transition-colors text-left">
            <Link2 size={13} className="text-text-secondary flex-shrink-0" />
            Copier le lien
          </button>
          {isAuthor && onEdit && (
            <>
              <div className="h-px bg-[#C9C2B5] mx-2 my-1" />
              <button onClick={() => { onEdit(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-primary hover:bg-[#ECE8E1] transition-colors text-left">
                <Edit2 size={13} className="text-text-secondary flex-shrink-0" />
                Modifier
              </button>
              <button onClick={() => { onDelete?.(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#C86C6C] hover:bg-[#ECE8E1] transition-colors text-left">
                <Trash2 size={13} className="flex-shrink-0" />
                Supprimer
              </button>
            </>
          )}
          {!isAuthor && onReport && (
            <>
              <div className="h-px bg-[#C9C2B5] mx-2 my-1" />
              <button onClick={() => { onReport(); setOpen(false); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#C86C6C] hover:bg-[#ECE8E1] transition-colors text-left">
                <Flag size={13} className="flex-shrink-0" />
                Signaler
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  entry: TrackDiaryEntryDetail;
  currentUser: { id: string; email?: string } | null;
}

export default function TrackDiaryEntryClient({ entry, currentUser }: Props) {
  const { profile } = useAuth();
  const isAuthor = currentUser?.id === entry.author.id;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const [hasLiked, setHasLiked] = useState(entry.has_liked);
  const [likesCount, setLikesCount] = useState(entry.stats.likes_count);
  const [showLikesSheet, setShowLikesSheet] = useState(false);
  const [comments, setComments] = useState<TrackDiaryComment[]>(entry.comments);
  const [newComment, setNewComment] = useState('');
  const [liking, setLiking] = useState(false);
  const [posting, setPosting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ parentCommentId: string; mentionUsername: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  const totalComments = comments.reduce((acc, c) => acc + 1 + c.replies.length, 0);

  const handleLike = async () => {
    if (!currentUser) { showToast('Connecte-toi pour aimer cette entrée', 'error'); return; }
    if (liking) return;
    const prevLiked = hasLiked;
    const prevCount = likesCount;
    setHasLiked(!prevLiked);
    setLikesCount(!prevLiked ? prevCount + 1 : Math.max(0, prevCount - 1));
    setLiking(true);
    try {
      await toggleTrackDiaryLike(entry.id);
    } catch {
      setHasLiked(prevLiked);
      setLikesCount(prevCount);
      showToast("Impossible d'aimer cette entrée", 'error');
    } finally {
      setLiking(false);
    }
  };

  const handleAddComment = async () => {
    if (!currentUser) { showToast('Connecte-toi pour commenter', 'error'); return; }
    if (posting || !newComment.trim()) return;
    setPosting(true);
    try {
      await addTrackComment(entry.id, newComment.trim());
      setNewComment('');
      setComments(await getTrackEntryComments(entry.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossible d'ajouter le commentaire", 'error');
    } finally {
      setPosting(false);
    }
  };

  const handleAddReply = async () => {
    if (!currentUser || !replyingTo || posting || !replyText.trim()) return;
    const { parentCommentId } = replyingTo;
    setPosting(true);
    try {
      await addTrackComment(entry.id, replyText.trim(), parentCommentId);
      setReplyText('');
      setReplyingTo(null);
      setExpandedReplies((prev) => new Set([...prev, parentCommentId]));
      setComments(await getTrackEntryComments(entry.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossible d'ajouter la réponse", 'error');
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteTrackComment(commentId);
      setComments((prev) =>
        prev.filter((c) => c.id !== commentId).map((c) => ({ ...c, replies: c.replies.filter((r) => r.id !== commentId) }))
      );
    } catch {
      showToast('Impossible de supprimer le commentaire', 'error');
    }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/track-diary/${entry.id}`;
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ url, title: entry.track.title }); } catch {}
    } else {
      await handleCopyLink();
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/track-diary/${entry.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Lien copié', 'success');
    } catch {
      showToast('Impossible de copier le lien', 'error');
    }
  };

  const handleReportEntry = async () => {
    if (!currentUser) return;
    const result = await reportContent('track_diary_entry', entry.id);
    showToast(
      result.success ? 'Contenu signalé — merci' : (result.error ?? 'Erreur'),
      result.success ? 'success' : 'error'
    );
  };

  return (
    <div className="max-w-page mx-auto px-4 pt-4 pb-6">
      <BackButton label="Journal" fallbackHref="/diary" />

      {/* ── Track hero ─────────────────────────────────────────── */}
      <div className="mt-4 pb-5 border-b border-[#D8D3CB]">
        <div className="flex gap-4 items-end">
          <div className="flex-shrink-0">
            <Link href={`/albums/${entry.album.id}`}>
              {entry.album.cover_url ? (
                <Image src={entry.album.cover_url} alt={entry.album.title} width={84} height={84} className="rounded-[8px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06),0_2px_6px_rgba(60,40,20,0.12)]" />
              ) : (
                <div className="w-[84px] h-[84px] bg-background-secondary rounded-[8px]" />
              )}
            </Link>
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <p className="text-[9.5px] uppercase tracking-[0.22em] text-text-tertiary mb-1">Titre</p>
            <Link href={`/tracks/${entry.track.id}`}>
              <h1 className="font-display font-normal text-[28px] leading-[1.05] text-text-warm tracking-tight hover:text-accent transition-colors">
                {entry.track.title}
              </h1>
            </Link>
            <div className="flex items-baseline gap-2 mt-1.5 flex-wrap">
              <Link href={`/artists/${entry.artist.id}`} className="font-medium text-[13.5px] text-text-secondary hover:text-text-primary transition-colors">
                {entry.artist.name}
              </Link>
              <span className="w-[3px] h-[3px] rounded-full bg-[#B5B0A6]" />
              <Link href={`/albums/${entry.album.id}`} className="text-[12px] text-text-tertiary hover:text-text-secondary transition-colors">
                {entry.album.title}
              </Link>
              {entry.album.release_date && (
                <>
                  <span className="w-[3px] h-[3px] rounded-full bg-[#B5B0A6]" />
                  <span className="text-[12px] text-text-tertiary">{new Date(entry.album.release_date).getFullYear()}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Critique block — à plat ─────────────────────────────── */}
      <div className="relative pl-4 mt-5">
        <div className="absolute left-0 top-2 bottom-4 w-0.5 bg-accent rounded-full opacity-55" />

        <div className="flex items-center gap-3">
          <Link href={`/u/${entry.author.username}`} className="flex-shrink-0">
            <UserAvatar userId={entry.author.id} src={entry.author.avatar_url} size={34} />
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-text-secondary leading-tight">
              Une écoute de{' '}
              <Link href={`/u/${entry.author.username}`} className="font-medium text-text-warm hover:text-text-primary transition-colors">
                {entry.author.username}
              </Link>
            </p>
            <p className="text-[11px] text-text-disabled mt-1 tracking-wide">{relativeTime(entry.listened_at)}</p>
          </div>
          <MoreMenu
            onShare={handleShare}
            onCopyLink={handleCopyLink}
            onReport={!isAuthor && currentUser ? handleReportEntry : undefined}
            onEdit={isAuthor ? () => setIsEditModalOpen(true) : undefined}
            onDelete={isAuthor ? () => setIsDeleteModalOpen(true) : undefined}
            isAuthor={isAuthor}
          />
          {isAuthor && (
            <EditTrackDiaryEntryButton
              entryId={entry.id}
              trackId={entry.track.id}
              albumId={entry.album.id}
              artistId={entry.artist.id}
              currentRating={entry.rating}
              currentReview={entry.review_body}
              currentListenedAt={entry.listened_at}
              headless={true}
              externalEditOpen={isEditModalOpen}
              onExternalEditClose={() => setIsEditModalOpen(false)}
              externalDeleteOpen={isDeleteModalOpen}
              onExternalDeleteClose={() => setIsDeleteModalOpen(false)}
            />
          )}
        </div>

        {entry.rating !== null && (
          <div className="flex items-baseline gap-1 mt-5">
            <span className="font-display italic text-[48px] leading-[0.9]" style={{ color: '#5C4538' }}>
              {entry.rating}
            </span>
            <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-accent opacity-75 mb-1.5 ml-0.5">/10</span>
          </div>
        )}

        {entry.review_body && (
          <p className="italic text-meta leading-relaxed text-text-secondary mt-4">
            &laquo;&thinsp;{entry.review_body.trim()}&thinsp;&raquo;
          </p>
        )}

        <div className="h-px bg-[#C9C2B5] mt-5 opacity-70" />
        <div className="flex items-center gap-4 mt-3 text-[12px] text-text-tertiary">
          {currentUser ? (
            <span className="flex items-center gap-1">
              <button
                onClick={handleLike}
                disabled={liking}
                className={`transition-colors duration-150 disabled:opacity-50 ${hasLiked ? 'text-[#C86C6C]' : 'hover:text-[#C86C6C]'}`}
              >
                <Heart size={15} fill={hasLiked ? 'currentColor' : 'none'} />
              </button>
              {likesCount > 0 ? (
                <button onClick={() => setShowLikesSheet(true)} className={`flex items-baseline gap-2 hover:underline ${hasLiked ? 'text-[#C86C6C]' : ''}`}>
                  <span>{likesCount}</span>
                  <span>J&apos;aime</span>
                </button>
              ) : (
                <span className="ml-1">J&apos;aime</span>
              )}
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <Heart size={15} />
              <span>{likesCount}</span>
              <span className="ml-1">J&apos;aime</span>
            </span>
          )}
        </div>
      </div>

      <LikesBottomSheet
        entryId={entry.id}
        contentType="track_diary_entry"
        isOpen={showLikesSheet}
        onClose={() => setShowLikesSheet(false)}
        count={likesCount}
      />

      {/* ── CTA ────────────────────────────────────────────────── */}
      <Link href={`/tracks/${entry.track.id}#reviews`} className="mt-5 flex items-center justify-between gap-3 px-4 py-3.5 bg-[#ECE8E1] border border-[#D8D3CB] rounded-[10px] hover:border-accent hover:bg-[#FAF8F4] transition-all duration-150 group">
        <div className="flex flex-col gap-0.5">
          <span className="text-[9.5px] uppercase tracking-[0.22em] text-text-tertiary">Continuer la lecture</span>
          <span className="font-display text-[16px] text-text-warm leading-tight">
            Les <em className="italic" style={{ color: '#5C4538' }}>critiques</em> de ce titre
          </span>
        </div>
        <span className="font-display italic text-[18px] text-accent group-hover:translate-x-1 transition-transform duration-150">→</span>
      </Link>

      {/* ── Réponses ───────────────────────────────────────────── */}
      <section className="mt-7 mb-20">
        <div className="flex items-baseline gap-2 mb-4">
          <h2 className="font-display font-normal text-[24px] text-text-warm leading-none">Réponses</h2>
          <span className="font-display italic text-[16px] leading-none" style={{ color: '#8E6F5E' }}>· {totalComments}</span>
          <div className="flex-1 h-px bg-[#C9C2B5] self-center ml-1.5" />
        </div>

        {!currentUser ? (
          <div className="mb-4 px-4 py-3.5 bg-[#FAF8F4] border border-[#D8D3CB] rounded-[12px]">
            <p className="text-[13px] text-text-secondary">
              <Link href="/auth/signin" className="font-medium text-text-warm hover:text-accent transition-colors">Connecte-toi</Link>
              {' '}pour liker et commenter cette écoute.
            </p>
          </div>
        ) : !isAuthor ? (
          <div className="bg-[#FAF8F4] border border-[#D8D3CB] rounded-[12px] p-3 mb-4 transition-all duration-150 focus-within:border-accent focus-within:shadow-[0_0_0_3px_rgba(142,111,94,0.08)]">
            <div className="flex gap-2.5 items-start">
              <UserAvatar userId={currentUser.id} src={profile?.avatar_url ?? null} size={28} className="mt-0.5 flex-shrink-0" />
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Ajouter quelques mots…"
                rows={1}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                className="flex-1 bg-transparent border-0 outline-none resize-none text-[13.5px] text-text-primary leading-[1.6] pt-0.5 placeholder:font-display placeholder:italic placeholder:text-text-tertiary placeholder:text-[14px]"
              />
            </div>
            <div className="flex justify-end mt-2.5">
              <button
                onClick={handleAddComment}
                disabled={posting || !newComment.trim()}
                className={`text-[13px] font-medium px-4 py-1.5 rounded-full border transition-colors duration-150 ${
                  !newComment.trim() ? 'border-border text-text-tertiary cursor-default' : 'border-accent text-accent hover:bg-accent hover:text-[#FAF8F4]'
                }`}
              >
                Envoyer
              </button>
            </div>
          </div>
        ) : null}

        {comments.length === 0 ? (
          <p className="font-display italic text-[15px] text-text-tertiary">Personne n&apos;a encore répondu.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {comments.map((comment) => {
              const replies = comment.replies ?? [];
              const isExpanded = expandedReplies.has(comment.id);
              const isReplyingHere = replyingTo?.parentCommentId === comment.id;

              return (
                <div key={comment.id}>
                  <div className={`flex gap-2.5 p-3 rounded-[12px] border border-[#D8D3CB] ${comment.is_mine ? 'bg-[#ECE8E1]' : 'bg-[#FAF8F4]'}`}>
                    <Link href={`/u/${comment.author.username}`} className="flex-shrink-0">
                      <UserAvatar userId={comment.author.id} src={comment.author.avatar_url} size={30} />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5 flex-wrap">
                        <Link href={`/u/${comment.author.username}`} className="font-medium text-[13px] text-text-warm hover:text-text-primary transition-colors">
                          {comment.author.username}
                        </Link>
                        <span className="w-[3px] h-[3px] rounded-full bg-[#B5B0A6] self-center" />
                        <span className="font-display italic text-[13px]" style={{ color: '#8E6F5E' }}>{shortDate(comment.created_at)}</span>
                        {comment.is_mine && (
                          <button onClick={() => handleDeleteComment(comment.id)} className="ml-auto p-1 rounded-[5px] text-text-disabled hover:text-[#C86C6C] hover:bg-background transition-colors" title="Supprimer">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                      <p className="text-[13.5px] text-text-primary leading-[1.65] mt-1.5">{comment.body}</p>
                      {currentUser && (
                        <button
                          onClick={() => isReplyingHere ? setReplyingTo(null) : setReplyingTo({ parentCommentId: comment.id, mentionUsername: comment.author.username })}
                          className="flex items-center gap-1.5 mt-2 text-[11.5px] text-accent hover:text-accent-deep transition-colors"
                        >
                          <CornerDownLeft size={10} />
                          {isReplyingHere ? 'Annuler' : 'Répondre'}
                        </button>
                      )}
                    </div>
                  </div>

                  {replies.length > 0 && (
                    <button
                      onClick={() => setExpandedReplies((prev) => { const next = new Set(prev); next.has(comment.id) ? next.delete(comment.id) : next.add(comment.id); return next; })}
                      className="flex items-center gap-2 mt-1.5 ml-9 text-[11.5px] text-text-tertiary hover:text-text-primary transition-colors"
                    >
                      <span className="w-3.5 h-px bg-[#C9C2B5]" />
                      {isExpanded ? 'Masquer les réponses' : <em className="font-display italic text-[12.5px]" style={{ color: '#8E6F5E' }}>Lire {replies.length} réponse{replies.length > 1 ? 's' : ''}</em>}
                    </button>
                  )}

                  {isExpanded && replies.length > 0 && (
                    <div className="relative mt-1.5 ml-9 pl-3.5 flex flex-col gap-2">
                      <div className="absolute left-0 top-0 bottom-3 w-px bg-[#C9C2B5]" />
                      {replies.map((reply) => (
                        <div key={reply.id} className={`flex gap-2 p-2.5 rounded-[10px] border border-[#D8D3CB] ${reply.is_mine ? 'bg-[#ECE8E1]' : 'bg-[#FAF8F4]'}`}>
                          <Link href={`/u/${reply.author.username}`} className="flex-shrink-0">
                            <UserAvatar userId={reply.author.id} src={reply.author.avatar_url} size={26} />
                          </Link>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <Link href={`/u/${reply.author.username}`} className="font-medium text-[12.5px] text-text-warm hover:text-text-primary transition-colors">
                                {reply.author.username}
                              </Link>
                              <span className="w-[3px] h-[3px] rounded-full bg-[#B5B0A6] self-center" />
                              <span className="font-display italic text-[12.5px]" style={{ color: '#8E6F5E' }}>{shortDate(reply.created_at)}</span>
                              {reply.is_mine && (
                                <button onClick={() => handleDeleteComment(reply.id)} className="ml-auto p-1 rounded-[5px] text-text-disabled hover:text-[#C86C6C] hover:bg-background transition-colors" title="Supprimer">
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                            <p className="text-[13px] text-text-primary leading-[1.65] mt-1">{reply.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {isReplyingHere && (
                    <div className="flex gap-2 mt-2 ml-9">
                      <input
                        type="text"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`Répondre à @${replyingTo.mentionUsername}…`}
                        autoFocus
                        className="flex-1 bg-[#FAF8F4] border border-[#D8D3CB] rounded-[10px] px-3 py-2 text-[13px] text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent transition-all"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddReply(); }
                          if (e.key === 'Escape') { setReplyingTo(null); setReplyText(''); }
                        }}
                      />
                      <button
                        onClick={handleAddReply}
                        disabled={posting || !replyText.trim()}
                        className={`flex-shrink-0 px-4 py-1.5 rounded-full border text-[12.5px] font-medium transition-colors duration-150 ${
                          !replyText.trim() ? 'border-border text-text-tertiary cursor-default' : 'border-accent text-accent hover:bg-accent hover:text-[#FAF8F4]'
                        }`}
                      >
                        Envoyer
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
