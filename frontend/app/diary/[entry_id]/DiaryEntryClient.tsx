'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Heart, Trash2, CornerDownLeft, Flag, Share2, Link2, MoreHorizontal, Edit2 } from 'lucide-react';
import { toggleDiaryLike, addComment, deleteComment, getEntryComments } from '@/app/actions/diary';
import { reportContent } from '@/app/actions/moderation';
import { showToast } from '@/components/ui/Toast';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import BackButton from '@/components/ui/BackButton';
import EditDiaryEntryButton from '@/components/album/EditDiaryEntryButton';
import LikesBottomSheet from '@/components/ui/LikesBottomSheet';
import { useAuth } from '@/lib/AuthContext';
import type { DiaryEntryDetail, DiaryEntryComment } from '@/app/actions/diary';
import { creditParts } from '@/lib/creditedArtists';

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
          <button
            onClick={() => { onShare(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-primary hover:bg-[#ECE8E1] transition-colors text-left"
          >
            <Share2 size={13} className="text-text-secondary flex-shrink-0" />
            Partager
          </button>
          <button
            onClick={() => { onCopyLink(); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-primary hover:bg-[#ECE8E1] transition-colors text-left"
          >
            <Link2 size={13} className="text-text-secondary flex-shrink-0" />
            Copier le lien
          </button>
          {isAuthor && onEdit && (
            <>
              <div className="h-px bg-[#C9C2B5] mx-2 my-1" />
              <button
                onClick={() => { onEdit(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-text-primary hover:bg-[#ECE8E1] transition-colors text-left"
              >
                <Edit2 size={13} className="text-text-secondary flex-shrink-0" />
                Modifier
              </button>
              <button
                onClick={() => { onDelete?.(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#C86C6C] hover:bg-[#ECE8E1] transition-colors text-left"
              >
                <Trash2 size={13} className="flex-shrink-0" />
                Supprimer
              </button>
            </>
          )}
          {!isAuthor && onReport && (
            <>
              <div className="h-px bg-[#C9C2B5] mx-2 my-1" />
              <button
                onClick={() => { onReport(); setOpen(false); }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#C86C6C] hover:bg-[#ECE8E1] transition-colors text-left"
              >
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

interface DiaryEntryClientProps {
  entry: DiaryEntryDetail;
  currentUser: { id: string; email?: string } | null;
}

export default function DiaryEntryClient({ entry, currentUser }: DiaryEntryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hasLiked, setHasLiked] = useState(entry.has_liked);
  const [likesCount, setLikesCount] = useState(entry.stats.likes_count);
  const [comments, setComments] = useState<DiaryEntryComment[]>(entry.comments);
  const [newComment, setNewComment] = useState('');
  const [liking, setLiking] = useState(false);
  const [posting, setPosting] = useState(false);
  const [showLikesSheet, setShowLikesSheet] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ parentCommentId: string; mentionUsername: string } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());

  const { profile } = useAuth();
  const isAuthor = currentUser?.id === entry.author.id;
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const totalComments = comments.reduce((acc, c) => acc + 1 + (c.replies ?? []).length, 0);

  useEffect(() => {
    const replyId = searchParams.get('reply');
    if (!replyId) return;
    const parentComment = comments.find((c) => (c.replies ?? []).some((r) => r.id === replyId));
    if (parentComment) {
      setExpandedReplies((prev) => new Set([...prev, parentComment.id]));
      setTimeout(() => {
        document.getElementById(`comment-${replyId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 150);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!['#comments', '#commentaires'].includes(window.location.hash)) return;

    let attempts = 0;
    const scrollToComments = () => {
      const target = document.getElementById('comments') ?? document.getElementById('commentaires');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      attempts += 1;
      if (attempts < 10) setTimeout(scrollToComments, 100);
    };

    setTimeout(scrollToComments, 0);
  }, []);

  const handleLike = async () => {
    if (!currentUser) { showToast('Connecte-toi pour aimer cette entrée', 'error'); return; }
    if (liking) return;
    const prevLiked = hasLiked;
    const prevCount = likesCount;
    setHasLiked(!prevLiked);
    setLikesCount(!prevLiked ? prevCount + 1 : Math.max(0, prevCount - 1));
    setLiking(true);
    try {
      await toggleDiaryLike(entry.id);
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
      await addComment(entry.id, newComment.trim());
      setNewComment('');
      setComments(await getEntryComments(entry.id));
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
      await addComment(entry.id, replyText.trim(), parentCommentId);
      setReplyText('');
      setReplyingTo(null);
      setExpandedReplies((prev) => new Set([...prev, parentCommentId]));
      setComments(await getEntryComments(entry.id));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Impossible d'ajouter la réponse", 'error');
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      setComments((prev) =>
        prev.filter((c) => c.id !== commentId).map((c) => ({ ...c, replies: (c.replies ?? []).filter((r) => r.id !== commentId) }))
      );
    } catch {
      showToast('Impossible de supprimer le commentaire', 'error');
    }
  };

  const handleReportEntry = async () => {
    if (!currentUser) return;
    const result = await reportContent('diary_entry', entry.id);
    showToast(result.success ? 'Contenu signalé — merci' : (result.error ?? 'Erreur'), result.success ? 'success' : 'error');
  };

  const handleReportComment = async (commentId: string) => {
    if (!currentUser) return;
    const result = await reportContent('diary_comment', commentId);
    showToast(result.success ? 'Commentaire signalé' : (result.error ?? 'Erreur'), result.success ? 'success' : 'error');
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/diary/${entry.id}`;
    if (typeof navigator.share === 'function') {
      try { await navigator.share({ url, title: entry.album.title }); } catch {}
    } else {
      await handleCopyLink();
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/diary/${entry.id}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast('Lien copié', 'success');
    } catch {
      showToast('Impossible de copier le lien', 'error');
    }
  };

  return (
    <div className="max-w-page mx-auto px-4 pt-4 pb-24">
      <BackButton label="Journal" fallbackHref="/me" />

      {/* ── Album hero ─────────────────────────────────────────── */}
      <div className="mt-4 pb-5 border-b border-[#D8D3CB]">
        <div className="flex gap-4 items-end">
          <div className="flex-shrink-0">
            <Link href={`/albums/${entry.album.id}`}>
              {entry.album.cover_url ? (
                <Image
                  src={entry.album.cover_url}
                  alt={entry.album.title}
                  width={84}
                  height={84}
                  className="rounded-[8px] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06),0_2px_6px_rgba(60,40,20,0.12)]"
                  unoptimized
                />
              ) : (
                <div className="w-[84px] h-[84px] bg-background-secondary rounded-[8px]" />
              )}
            </Link>
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <p className="text-[9.5px] uppercase tracking-[0.22em] text-text-tertiary mb-1">Album</p>
            <Link href={`/albums/${entry.album.id}`}>
              <h1 className="font-display font-normal text-[28px] leading-[1.05] text-text-warm tracking-tight hover:text-accent transition-colors">
                {entry.album.title}
              </h1>
            </Link>
            <div className="flex items-baseline gap-2 mt-1.5 flex-wrap">
              <span className="font-medium text-[13.5px] text-text-secondary">
                {creditParts(entry.artist, entry.featuredArtists).map((part, i) => (
                  <span key={part.artist.id || i}>
                    {part.prefix}
                    <Link href={`/artists/${part.artist.id}`} className="hover:text-text-primary transition-colors">
                      {part.artist.name}
                    </Link>
                  </span>
                ))}
              </span>
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

        {/* Author row */}
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
              {entry.re_listen && <span className="text-text-disabled"> · ré-écoute</span>}
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
            <EditDiaryEntryButton
              entryId={entry.id}
              albumId={entry.album.id}
              currentRating={entry.rating}
              currentReview={entry.review_body}
              currentListenedAt={entry.listened_at}
              onUpdated={() => router.refresh()}
              showDelete={true}
              variant="compact"
              headless={true}
              externalEditOpen={isEditModalOpen}
              onExternalEditClose={() => setIsEditModalOpen(false)}
              externalDeleteOpen={isDeleteModalOpen}
              onExternalDeleteClose={() => setIsDeleteModalOpen(false)}
            />
          )}
        </div>

        {/* Rating */}
        {entry.rating !== null && (
          <div className="flex items-baseline gap-1 mt-5">
            <span className="font-display italic text-[48px] leading-[0.9]" style={{ color: '#5C4538' }}>
              {entry.rating}
            </span>
            <span className="font-sans text-[10px] uppercase tracking-[0.16em] text-accent opacity-75 mb-1.5 ml-0.5">/10</span>
          </div>
        )}

        {/* Review body */}
        {entry.review_body && (
          <p className="font-display italic text-meta leading-relaxed text-accent-deep mt-4">
            &laquo;&thinsp;{entry.review_body.trim()}&thinsp;&raquo;
          </p>
        )}

        {/* Hairline + actions */}
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

      {!currentUser && (
        <div className="mt-4 px-4 py-3.5 bg-[#FAF8F4] border border-[#D8D3CB] rounded-[12px]">
          <p className="text-[13px] text-text-secondary">
            <Link href="/auth?mode=login" className="font-medium text-text-warm underline hover:text-accent transition-colors">Connecte-toi</Link>
            {' '}pour liker et commenter cette écoute.
          </p>
        </div>
      )}

      <LikesBottomSheet entryId={entry.id} isOpen={showLikesSheet} onClose={() => setShowLikesSheet(false)} count={likesCount} />

      {/* ── CTA ────────────────────────────────────────────────── */}
      <Link
        href={`/albums/${entry.album.id}#reviews`}
        className="mt-5 flex items-center justify-between gap-3 px-4 py-3.5 bg-[#ECE8E1] border border-[#D8D3CB] rounded-[10px] hover:border-accent hover:bg-[#FAF8F4] transition-all duration-150 group"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-[9.5px] uppercase tracking-[0.22em] text-text-tertiary">Continuer la lecture</span>
          <span className="font-display text-[16px] text-text-warm leading-tight">
            Les <em className="italic" style={{ color: '#5C4538' }}>critiques</em> de cet album
          </span>
        </div>
        <span className="font-display italic text-[18px] text-accent group-hover:translate-x-1 transition-transform duration-150">→</span>
      </Link>

      {/* ── Réponses ───────────────────────────────────────────── */}
      <section id="comments" className="mt-7 mb-20 scroll-mt-24">
        <span id="commentaires" className="sr-only" aria-hidden="true" />
        <div className="flex items-baseline gap-2 mb-4">
          <h2 className="font-display font-normal text-[24px] text-text-warm leading-none">Réponses</h2>
          <span className="font-display italic text-[16px] leading-none" style={{ color: '#8E6F5E' }}>· {totalComments}</span>
          <div className="flex-1 h-px bg-[#C9C2B5] self-center ml-1.5" />
        </div>

        {!currentUser ? null : !isAuthor ? (
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

              const toggleExpand = () =>
                setExpandedReplies((prev) => { const next = new Set(prev); next.has(comment.id) ? next.delete(comment.id) : next.add(comment.id); return next; });

              const openReplyForm = (mentionUsername: string, expand = false) => {
                if (expand) setExpandedReplies((prev) => new Set([...prev, comment.id]));
                setReplyingTo({ parentCommentId: comment.id, mentionUsername });
                setReplyText(mentionUsername !== comment.author.username ? `@${mentionUsername} ` : '');
              };

              return (
                <div key={comment.id} id={`comment-${comment.id}`}>
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
                        {comment.is_mine ? (
                          <button onClick={() => handleDeleteComment(comment.id)} className="ml-auto p-1 rounded-[5px] text-text-disabled hover:text-[#C86C6C] hover:bg-background transition-colors" title="Supprimer">
                            <Trash2 size={12} />
                          </button>
                        ) : currentUser ? (
                          <button onClick={() => handleReportComment(comment.id)} className="ml-auto p-1 rounded-[5px] text-text-disabled hover:text-[#C86C6C] transition-colors" title="Signaler">
                            <Flag size={12} />
                          </button>
                        ) : null}
                      </div>
                      <p className="text-[13.5px] text-text-primary leading-[1.65] mt-1.5">{comment.body}</p>
                      {currentUser && (
                        <button
                          onClick={() => isReplyingHere ? setReplyingTo(null) : openReplyForm(comment.author.username)}
                          className="flex items-center gap-1.5 mt-2 text-[11.5px] text-accent hover:text-accent-deep transition-colors"
                        >
                          <CornerDownLeft size={10} />
                          {isReplyingHere ? 'Annuler' : 'Répondre'}
                        </button>
                      )}
                    </div>
                  </div>

                  {replies.length > 0 && (
                    <button onClick={toggleExpand} className="flex items-center gap-2 mt-1.5 ml-9 text-[11.5px] text-text-tertiary hover:text-text-primary transition-colors">
                      <span className="w-3.5 h-px bg-[#C9C2B5]" />
                      {isExpanded
                        ? 'Masquer les réponses'
                        : <em className="font-display italic text-[12.5px]" style={{ color: '#8E6F5E' }}>Lire {replies.length} réponse{replies.length > 1 ? 's' : ''}</em>}
                    </button>
                  )}

                  {isExpanded && replies.length > 0 && (
                    <div className="relative mt-1.5 ml-9 pl-3.5 flex flex-col gap-2">
                      <div className="absolute left-0 top-0 bottom-3 w-px bg-[#C9C2B5]" />
                      {replies.map((reply) => (
                        <div key={reply.id} id={`comment-${reply.id}`} className={`flex gap-2 p-2.5 rounded-[10px] border border-[#D8D3CB] ${reply.is_mine ? 'bg-[#ECE8E1]' : 'bg-[#FAF8F4]'}`}>
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
                            {currentUser && (
                              <button onClick={() => openReplyForm(reply.author.username, true)} className="flex items-center gap-1.5 mt-1.5 text-[11px] text-accent hover:text-accent-deep transition-colors">
                                <CornerDownLeft size={9} />
                                Répondre
                              </button>
                            )}
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
