'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, MessageCircle, Trash2, Flag } from 'lucide-react';
import { toggleDiaryLike, addComment, deleteComment, getEntryComments } from '@/app/actions/diary';
import { reportContent } from '@/app/actions/moderation';
import { showToast } from '@/components/Toast';
import { UserAvatar } from '@/components/avatars/DefaultAvatar';
import BackButton from '@/components/BackButton';
import EditDiaryEntryButton from '@/components/EditDiaryEntryButton';
import LikesBottomSheet from '@/components/LikesBottomSheet';
import ShareButton from '@/components/ShareButton';
import type { DiaryEntryDetail, DiaryEntryComment } from '@/app/actions/diary';

interface DiaryEntryClientProps {
  entry: DiaryEntryDetail;
  currentUser: { id: string; email?: string } | null;
}

export default function DiaryEntryClient({ entry, currentUser }: DiaryEntryClientProps) {
  const router = useRouter();
  const [hasLiked, setHasLiked] = useState(entry.has_liked);
  const [likesCount, setLikesCount] = useState(entry.stats.likes_count);
  const [comments, setComments] = useState<DiaryEntryComment[]>(entry.comments);
  const [newComment, setNewComment] = useState('');
  const [liking, setLiking] = useState(false);
  const [posting, setPosting] = useState(false);
  const [showLikesSheet, setShowLikesSheet] = useState(false);

  const isAuthor = currentUser?.id === entry.author.id;

  const handleLike = async () => {
    if (!currentUser) {
      showToast('Connecte-toi pour aimer cette entrée', 'error');
      return;
    }
    if (liking) return;

    // Optimistic update
    const prevLiked = hasLiked;
    const prevCount = likesCount;
    const newLiked = !prevLiked;
    setHasLiked(newLiked);
    setLikesCount(newLiked ? prevCount + 1 : Math.max(0, prevCount - 1));
    setLiking(true);

    try {
      await toggleDiaryLike(entry.id);
    } catch (err) {
      // Revert on error
      setHasLiked(prevLiked);
      setLikesCount(prevCount);
      console.error('Like error:', err);
      showToast(err instanceof Error ? err.message : 'Impossible d\'aimer cette entrée', 'error');
    } finally {
      setLiking(false);
    }
  };

  const handleAddComment = async () => {
    if (!currentUser) {
      showToast('Connecte-toi pour commenter', 'error');
      return;
    }
    if (posting || !newComment.trim()) return;
    setPosting(true);
    try {
      await addComment(entry.id, newComment.trim());
      setNewComment('');
      const freshComments = await getEntryComments(entry.id);
      setComments(freshComments);
    } catch (err) {
      console.error('Add comment error:', err);
      showToast(err instanceof Error ? err.message : 'Impossible d\'ajouter le commentaire', 'error');
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error('Delete comment error:', err);
      showToast('Impossible de supprimer le commentaire', 'error');
    }
  };

  const handleReportEntry = async () => {
    if (!currentUser) {
      showToast('Connecte-toi pour signaler du contenu', 'error');
      return;
    }
    const result = await reportContent('diary_entry', entry.id);
    showToast(result.success ? 'Contenu signalé — merci' : (result.error ?? 'Erreur'), result.success ? 'success' : 'error');
  };

  const handleReportComment = async (commentId: string) => {
    if (!currentUser) return;
    const result = await reportContent('diary_comment', commentId);
    showToast(result.success ? 'Commentaire signalé' : (result.error ?? 'Erreur'), result.success ? 'success' : 'error');
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="max-w-page mx-auto px-4 py-6">
        {/* Back button */}
        <BackButton />

        {/* Album header */}
        <div className="flex gap-6 mb-6 mt-4">
          {entry.album.cover_url ? (
            <Link href={`/albums/${entry.album.id}`}>
              <Image
                src={entry.album.cover_url}
                alt={entry.album.title}
                width={100}
                height={100}
                className="rounded-[10px]"
              />
            </Link>
          ) : (
            <div className="w-[100px] h-[100px] bg-background-secondary rounded-[10px]" />
          )}
          <div className="flex-1 min-w-0 flex flex-col justify-center mt-2">
            <Link
              href={`/albums/${entry.album.id}`}
              className="text-h2 hover:text-text-secondary transition-colors duration-150 block mb-2 text-text-primary"
            >
              {entry.album.title}
            </Link>
            <div className="text-body text-text-secondary mb-4">
              <Link href={`/artists/${entry.artist.id}`} className="hover:text-text-primary transition-colors duration-150">
                {entry.artist.name}
              </Link>
              {entry.album.release_date && ` · ${new Date(entry.album.release_date).getFullYear()}`}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-b border-border my-6" />

        {/* Author info with Edit/Delete buttons */}
        <div className="flex items-start gap-3 mb-6">
          <Link href={`/u/${entry.author.username}`}>
            <UserAvatar userId={entry.author.id} src={entry.author.avatar_url} size={48} />
          </Link>
          <div className="flex-1">
            <p className="text-meta text-text-secondary">
              Une écoute de{' '}
              <Link
                href={`/u/${entry.author.username}`}
                className="font-medium hover:text-text-primary transition-colors duration-150"
              >
                {entry.author.username}
              </Link>
            </p>
            <p className="text-label text-text-tertiary mt-1">
              {formatDate(entry.listened_at)}
              {entry.re_listen && <span className="ml-2">• ré-écoute</span>}
            </p>
          </div>
          {isAuthor ? (
            <div className="flex-shrink-0">
              <EditDiaryEntryButton
                entryId={entry.id}
                albumId={entry.album.id}
                currentRating={entry.rating}
                currentReview={entry.review_body}
                currentListenedAt={entry.listened_at}
                onUpdated={() => router.refresh()}
                showDelete={true}
                variant="compact"
              />
            </div>
          ) : currentUser && (
            <button
              onClick={handleReportEntry}
              title="Signaler cette écoute"
              className="flex-shrink-0 text-text-tertiary hover:text-[#C86C6C] transition-colors duration-150"
            >
              <Flag size={15} />
            </button>
          )}
        </div>

        {/* Rating */}
        {entry.rating !== null && (
          <div className="mt-6">
            <div className="text-label uppercase text-text-secondary mb-2">Note</div>
            <p className="text-body text-text-primary">
              {entry.rating} / 10
            </p>
          </div>
        )}

        {/* Review */}
        {(entry.review_title || entry.review_body) && (
          <div className="mt-6">
            {entry.review_title && (
              <h2 className="text-[14px] font-medium text-text-primary mb-3">{entry.review_title}</h2>
            )}
            {entry.review_body && (
              <p className="text-[14px] text-text-primary whitespace-pre-wrap leading-[1.7] italic">
                {`«\u202F${entry.review_body.trim()}`}<span className="whitespace-nowrap">{'\u202F»'}</span>
              </p>
            )}
          </div>
        )}

        {/* Like button */}
        <div className="flex items-center gap-6 mt-8">
          <div className="flex items-center gap-2">
            {currentUser ? (
              <button
                onClick={handleLike}
                disabled={liking}
                className="text-text-tertiary hover:text-[#C86C6C] transition-colors duration-150 disabled:opacity-50 focus:outline-none"
              >
                <Heart
                  size={18}
                  fill={hasLiked ? 'currentColor' : 'none'}
                  className={hasLiked ? 'text-[#C86C6C]' : ''}
                />
              </button>
            ) : (
              <Heart size={18} className="text-text-tertiary" />
            )}
            <span className="text-label text-text-tertiary">{likesCount}</span>
            {likesCount > 0 ? (
              <button
                onClick={() => setShowLikesSheet(true)}
                className="text-label text-text-tertiary hover:text-text-primary transition-colors duration-150 focus:outline-none"
              >
                j'aime{likesCount > 1 ? 's' : ''}
              </button>
            ) : (
              <span className="text-label text-text-disabled">j'aime</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-text-tertiary">
            <MessageCircle size={18} />
            <span className="text-label">{comments.length}</span>
          </div>
          <div className="ml-auto">
            <ShareButton entryId={entry.id} />
          </div>
        </div>

        <LikesBottomSheet
          entryId={entry.id}
          isOpen={showLikesSheet}
          onClose={() => setShowLikesSheet(false)}
          count={likesCount}
        />

        {/* Link to all album reviews */}
        <div className="mt-6">
          <Link
            href={`/albums/${entry.album.id}#reviews`}
            className="text-meta text-text-secondary hover:text-text-primary transition-colors duration-150 inline-flex items-center gap-1"
          >
            Voir toutes les critiques de cet album →
          </Link>
        </div>

        {/* Comments section */}
        <section className="border-t border-border pt-8 mt-8 mb-20">
          <h3 className="text-label font-medium text-text-primary uppercase mb-6">Réponses</h3>

          {/* Comment form - only show if logged in */}
          {currentUser ? (
            <div className="flex gap-3 mb-6">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Ajouter quelques mots…"
                className={`flex-1 bg-background-secondary border border-border rounded-[10px] px-3 py-2 text-text-primary placeholder-text-tertiary focus:outline-none focus:border-[#8E6F5E] transition-all ${
                  newComment.length === 0 ? 'opacity-70' : 'opacity-100'
                }`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAddComment();
                  }
                }}
              />
              <button
                onClick={handleAddComment}
                disabled={posting || !newComment.trim()}
                className="px-4 py-2 border border-border text-text-primary hover:bg-[#1C1C1C] hover:text-[#F5F3EF] disabled:bg-background-secondary disabled:text-text-disabled disabled:border-border rounded-[8px] text-meta font-medium transition-colors duration-150"
              >
                Envoyer
              </button>
            </div>
          ) : (
            <div className="mb-6 p-4 bg-background-secondary rounded-[10px] border border-border">
              <p className="text-meta text-text-secondary">
                <Link href="/auth/signin" className="text-text-primary hover:text-[#8E6F5E] font-medium transition-colors duration-150">
                  Connectez-vous
                </Link>
                {' '}pour liker et commenter cette écoute.
              </p>
            </div>
          )}

          {/* Comments list */}
          {comments.length === 0 ? (
            <p className="text-text-tertiary text-meta">Personne n'a encore répondu.</p>
          ) : (
            <div className="space-y-4">
              {comments.map((comment) => (
                <div key={comment.id} className="flex gap-3 group">
                  <Link href={`/u/${comment.author.username}`}>
                    <UserAvatar userId={comment.author.id} src={comment.author.avatar_url} size={32} />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 text-meta">
                      <Link
                        href={`/u/${comment.author.username}`}
                        className="font-medium text-text-primary hover:text-text-secondary transition-colors duration-150"
                      >
                        {comment.author.username}
                      </Link>
                      <span className="text-label text-text-tertiary flex-1">
                        {formatDate(comment.created_at)}
                      </span>
                      {comment.is_mine ? (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="text-text-tertiary hover:text-text-primary transition-colors duration-150"
                          title="Supprimer"
                        >
                          <Trash2 size={14} />
                        </button>
                      ) : currentUser && (
                        <button
                          onClick={() => handleReportComment(comment.id)}
                          className="text-text-tertiary hover:text-[#C86C6C] transition-colors duration-150 opacity-0 group-hover:opacity-100"
                          title="Signaler"
                        >
                          <Flag size={14} />
                        </button>
                      )}
                    </div>
                    <p className="text-[14px] text-text-primary leading-[1.7] mt-2">{comment.body}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
  );
}
