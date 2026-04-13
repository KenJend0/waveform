import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getOgEntryData, truncate, truncateSemantic, formatDate } from '../../_lib/getData';
import { loadFonts } from '../../_lib/fonts';

export const runtime = 'nodejs';

// ─── Dimensions ───────────────────────────────────────────────────────────────
const W = 1080;
const H = 1920;

// ─── Carte compacte ───────────────────────────────────────────────────────────
const CARD_W = 860;
const PAD_H = 58;
const PAD_V = 64;
const COVER_SZ = 164;

// Position haute mais moins tassée visuellement
const STORY_TOP = 236;

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
  accentSoft: '#F0E5DC',
  border:  '#DAD5CD',
  surface: '#E5E0D8',
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ entry_id: string }> }
) {
  const { entry_id } = await params;

  const [data, fonts] = await Promise.all([
    getOgEntryData(entry_id),
    loadFonts(),
  ]);

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

  // Colonne texte album : CARD_W - 2×PAD_H - COVER_SZ - 28(gap) ≈ 500px
  const albumTitleShort = truncate(albumTitle, 52);
  const artistShort     = truncate(artistName, 40);
  // 30px italic sur 708px intérieur ≈ 29 chars/ligne → 4 lignes ≈ 190 chars
  const reviewExtract = reviewBody ? truncateSemantic(reviewBody, 170) : null;
  const formattedDate   = formatDate(listenedAt);
  const reviewTitleShort = reviewTitle ? truncate(reviewTitle, 48) : null;

  const hasReview      = reviewExtract !== null;
  const hasRating      = rating !== null;
  // rating inline dans le header quand la review occupe le corps
  const ratingInHeader = hasReview && hasRating;
  // rating héro centré quand pas de review
  const ratingHero     = !hasReview && hasRating;
  const showBody       = hasReview || ratingHero;

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

      {/* Safe zone supérieure Instagram */}
      <div style={{ display: 'flex', height: STORY_TOP }} />

      {/* ─── CARTE ──────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: CARD_W,
          backgroundColor: C.card,
          borderRadius: 28,
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: C.border,
          boxShadow: '0 18px 48px rgba(28, 28, 28, 0.05)',
          paddingTop: PAD_V,
          paddingBottom: PAD_V,
          paddingLeft: PAD_H,
          paddingRight: PAD_H,
        }}
      >

        {/* ── 1. Header : cover + infos album ─────────────────────────────── */}
        <div style={{ display: 'flex', gap: 28, alignItems: 'flex-start' }}>

          {/* Cover */}
          {coverDataUri ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverDataUri}
              width={COVER_SZ}
              height={COVER_SZ}
              style={{ borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
              alt=""
            />
          ) : (
            <div
              style={{
                display: 'flex',
                width: COVER_SZ,
                height: COVER_SZ,
                backgroundColor: C.surface,
                borderRadius: 8,
                flexShrink: 0,
              }}
            />
          )}

          {/* Infos album */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              paddingTop: 2,
              minWidth: 0,
            }}
          >
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

            <div style={{ display: 'flex', height: 10 }} />

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

            {/* Note inline — seulement quand la review occupe aussi le corps */}
            {ratingInHeader && (
              <>
                <div style={{ display: 'flex', height: 18 }} />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    alignSelf: 'flex-start',
                    paddingLeft: 14,
                    paddingRight: 14,
                    paddingTop: 8,
                    paddingBottom: 8,
                    borderRadius: 999,
                    backgroundColor: C.accentSoft,
                    gap: 4,
                  }}
                >
                  <span
                    style={{ fontSize: 24, fontWeight: 500, color: C.accent, lineHeight: 1 }}
                  >
                    {rating}
                  </span>
                  <span
                    style={{ fontSize: 16, fontWeight: 500, color: C.accent, lineHeight: 1 }}
                  >
                    {'/ 10'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Séparateur header ────────────────────────────────────────────── */}
        <div style={{ display: 'flex', height: 44 }} />
        <div style={{ display: 'flex', height: 1, backgroundColor: C.border }} />

        {/* ── 2. Corps : review éditoriale ou note héro ───────────────────── */}
        {showBody && (
          <>
            <div style={{ display: 'flex', height: 40 }} />

            {hasReview ? (
              /* Variante review : pull-quote éditoriale */
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {reviewTitleShort && (
                  <>
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 500,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        color: C.muted,
                      }}
                    >
                      {reviewTitleShort}
                    </span>
                    <div style={{ display: 'flex', height: 18 }} />
                  </>
                )}
                <span
                  style={{
                    fontSize: 56,
                    fontWeight: 500,
                    color: C.accent,
                    lineHeight: 0.7,
                    letterSpacing: '-0.03em',
                  }}
                >
                  {'\u00AB'}
                </span>
                <div style={{ display: 'flex', height: 20 }} />
                <span
                  style={{
                    fontSize: 31,
                    fontWeight: 400,
                    fontStyle: 'italic',
                    color: C.text,
                    lineHeight: 1.72,
                    letterSpacing: '-0.015em',
                  }}
                >
                  {reviewExtract}
                </span>
              </div>
            ) : (
              /* Variante no-review : la note devient le héros de la carte */
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingTop: 8,
                  paddingBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 120,
                    fontWeight: 500,
                    color: C.accent,
                    lineHeight: 0.92,
                    letterSpacing: '-0.05em',
                  }}
                >
                  {rating}
                </span>
                <div style={{ display: 'flex', height: 10 }} />
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 500,
                    color: C.muted,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                  }}
                >
                  {'/ 10'}
                </span>
              </div>
            )}

            {/* Séparateur corps → footer */}
            <div style={{ display: 'flex', height: 44 }} />
            <div style={{ display: 'flex', height: 1, backgroundColor: C.border }} />
          </>
        )}

        {/* ── 3. Footer : auteur + date + signature Waveform ──────────────── */}
        <div style={{ display: 'flex', height: 40 }} />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={{ fontSize: 23, fontWeight: 500, color: C.text, lineHeight: 1.2 }}>
              {authorName}
            </span>
            <span style={{ fontSize: 19, fontWeight: 400, color: C.muted, lineHeight: 1.3 }}>
              {formattedDate}
              {reListenLabel ? `\u2002\u00B7\u2002${reListenLabel}` : ''}
            </span>
          </div>

          {/* Signature discrète */}
          <span
            style={{
              fontSize: 16,
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
      {/* ─── FIN CARTE ────────────────────────────────────────────────────────── */}

      {/* Spacer flexible — pousse le hint vers la zone basse */}
      <div style={{ display: 'flex', flex: 1 }} />
    </div>
  );

  return new ImageResponse(image, {
    width: W,
    height: H,
    fonts: [
      { name: 'Inter', data: fonts.regular, weight: 400, style: 'normal' },
      { name: 'Inter', data: fonts.medium,  weight: 500, style: 'normal' },
      { name: 'Inter', data: fonts.italic,  weight: 400, style: 'italic' },
    ],
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
