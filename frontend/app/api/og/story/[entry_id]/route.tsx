import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getOgEntryData, truncate, truncateSemantic, formatDate } from '../../_lib/getData';
import { loadFonts } from '../../_lib/fonts';

export const runtime = 'nodejs';

// ─── Dimensions ───────────────────────────────────────────────────────────────
const W = 1080;
const H = 1920;

// ─── Carte ────────────────────────────────────────────────────────────────────
const CARD_W  = 760;
const PAD_H   = 64;   // padding horizontal du contenu texte
const PAD_V   = 56;   // padding vertical bas du contenu texte
const COVER_SIZE = CARD_W; // cover carrée alignée sur la largeur de la carte
const CARD_R  = 28;   // border-radius de la carte
const SECTION_GAP = 48;
const DIVIDER_TO_REVIEW_GAP = 48;
const REVIEW_TITLE_GAP = 20;

// Safe zones story
const STORY_TOP_MIN    = 140;
const STORY_BOTTOM_MIN = 240;

// ─── Palette Waveform ─────────────────────────────────────────────────────────
const C = {
  bg:      '#F5F3EF',
  card:    '#FCFAF6',
  wash:    '#EEE8DE',
  text:    '#1C1C1C',
  sub:     '#676767',
  muted:   '#9A9A9A',
  faint:   '#C2BDB6',
  accent:  '#8E6F5E',
  border:  '#DAD5CD',
  surface: '#E5E0D8',
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entry_id: string }> }
) {
  const { entry_id } = await params;

  let data: Awaited<ReturnType<typeof getOgEntryData>>;
  let fonts: Awaited<ReturnType<typeof loadFonts>>;

  try {
    [data, fonts] = await Promise.all([
      getOgEntryData(entry_id),
      loadFonts(),
    ]);
  } catch (err) {
    console.error('[OG story] init error:', err);
    return new Response('Internal error', { status: 500 });
  }

  if (!data) {
    return new Response('Not found', { status: 404 });
  }

  const {
    albumTitle,
    artistName,
    year,
    coverDataUri,
    authorName,
    reviewBody,
    rating,
    listenedAt,
    reListenLabel,
    reviewTitle,
  } = data;

  // Largeur utile texte : CARD_W - 2×PAD_H = 732px
  const albumTitleShort  = truncate(albumTitle, 58);
  const artistShort      = truncate(artistName, 48);
  const reviewExtract    = reviewBody ? truncateSemantic(reviewBody, 170) : null;
  const reviewTitleShort = reviewTitle ? truncate(reviewTitle, 52) : null;
  const formattedDate    = formatDate(listenedAt);

  const hasReview = reviewExtract !== null;
  const hasRating = rating !== null;
  const showBody  = hasReview;

  const image = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: W,
        height: H,
        backgroundColor: C.bg,
        fontFamily: 'Inter',
        position: 'relative',
      }}
    >
      {/* Taches de fond décoratives */}
      <div
        style={{
          position: 'absolute',
          top: 112,
          left: -72,
          width: 360,
          height: 360,
          borderRadius: 999,
          backgroundColor: C.wash,
          opacity: 0.55,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: -84,
          top: 1030,
          width: 420,
          height: 420,
          borderRadius: 999,
          backgroundColor: C.wash,
          opacity: 0.38,
        }}
      />

      {/* Spacer haut */}
      <div style={{ display: 'flex', flex: 1, minHeight: STORY_TOP_MIN }} />

      {/* ─── CARTE ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: CARD_W,
          backgroundColor: C.card,
          borderRadius: CARD_R,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: C.border,
        }}
      >

        {/* ── 1. Cover full-bleed ──────────────────────────────────────────── */}
        {coverDataUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverDataUri}
            width={COVER_SIZE}
            height={COVER_SIZE}
            style={{
              objectFit: 'cover',
              flexShrink: 0,
              borderTopLeftRadius: CARD_R - 1,
              borderTopRightRadius: CARD_R - 1,
            }}
            alt=""
          />
        ) : (
          <div
            style={{
              display: 'flex',
              width: COVER_SIZE,
              height: COVER_SIZE,
              backgroundColor: C.surface,
              borderTopLeftRadius: CARD_R - 1,
              borderTopRightRadius: CARD_R - 1,
              flexShrink: 0,
            }}
          />
        )}

        {/* ── 2. Contenu texte ─────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            paddingLeft: PAD_H,
            paddingRight: PAD_H,
            paddingTop: 40,
            paddingBottom: PAD_V,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
              }}
            >
              {/* Titre seul */}
              <span
                style={{
                  fontSize: 40,
                  fontWeight: 500,
                  color: C.text,
                  lineHeight: 1.14,
                  letterSpacing: '-0.03em',
                }}
              >
                {albumTitleShort}
              </span>

              <div style={{ display: 'flex', height: 12 }} />

              <span
                style={{
                  fontSize: 24,
                  fontWeight: 400,
                  color: C.sub,
                  lineHeight: 1.35,
                }}
              >
                {artistShort}
                {year ? `\u2002\u00B7\u2002${year}` : ''}
              </span>
            </div>

            {hasRating && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 7,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: 42,
                    fontWeight: 500,
                    color: C.accent,
                    lineHeight: 1,
                    letterSpacing: '-0.03em',
                  }}
                >
                  {rating}
                </span>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 500,
                    color: C.muted,
                    lineHeight: 1,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  {'/ 10'}
                </span>
              </div>
            )}
          </div>

          {/* ── Séparateur ────────────────────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              paddingTop: SECTION_GAP,
              paddingBottom: showBody ? DIVIDER_TO_REVIEW_GAP : SECTION_GAP,
            }}
          >
            <div style={{ display: 'flex', height: 1, backgroundColor: C.border }} />
          </div>

          {/* ── 3. Review (si présente) ───────────────────────────────────── */}
          {showBody && (
            <>
              {reviewTitleShort && (
                <>
                  <span
                    style={{
                      fontSize: 17,
                      fontWeight: 500,
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      color: C.muted,
                    }}
                  >
                    {reviewTitleShort}
                  </span>
                  <div style={{ display: 'flex', height: REVIEW_TITLE_GAP }} />
                </>
              )}

              <div
                style={{
                  fontSize: 30,
                  fontWeight: 400,
                  fontStyle: 'italic',
                  color: C.text,
                  lineHeight: 1.72,
                  letterSpacing: '-0.015em',
                }}
              >
                {reviewExtract}
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  paddingTop: SECTION_GAP,
                  paddingBottom: SECTION_GAP,
                }}
              >
                <div style={{ display: 'flex', height: 1, backgroundColor: C.border }} />
              </div>
            </>
          )}

          {/* ── 4. Footer : auteur + date + signature ─────────────────────── */}
          <div style={{ display: 'flex', height: SECTION_GAP }} />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 22, fontWeight: 500, color: C.text, lineHeight: 1.2 }}>
                {authorName}
              </span>
              <span style={{ fontSize: 18, fontWeight: 400, color: C.muted, lineHeight: 1.3 }}>
                {formattedDate}
                {reListenLabel ? `\u2002\u00B7\u2002${reListenLabel}` : ''}
              </span>
            </div>

            <span
              style={{
                fontSize: 15,
                fontWeight: 500,
                letterSpacing: '0.14em',
                color: C.faint,
                textTransform: 'uppercase',
              }}
            >
              Waveform
            </span>
          </div>
        </div>
      </div>
      {/* ─── FIN CARTE ────────────────────────────────────────────────────────── */}

      {/* Spacer bas — zone sticker Instagram */}
      <div style={{ display: 'flex', flex: 1.3, minHeight: STORY_BOTTOM_MIN }} />
    </div>
  );

  try {
    return new ImageResponse(image, {
      width: W,
      height: H,
      fonts: [
        { name: 'Inter', data: fonts.regular, weight: 400, style: 'normal' },
        { name: 'Inter', data: fonts.medium,  weight: 500, style: 'normal' },
        { name: 'Inter', data: fonts.italic,  weight: 400, style: 'italic' },
      ],
      headers: {
        'Cache-Control': 'private, max-age=600',
      },
    });
  } catch (err) {
    console.error('[OG story] render error:', err);
    return new Response('Render error', { status: 500 });
  }
}
