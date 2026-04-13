import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { getOgEntryData, truncate, truncateSemantic, formatDate } from '../../_lib/getData';
import { loadFonts } from '../../_lib/fonts';

export const runtime = 'nodejs';

// 1200×630 — Open Graph horizontal
const W = 1200;
const H = 630;
const PAD = 64;

const C = {
  bg: '#F5F3EF',
  text: '#1C1C1C',
  secondary: '#6B6B6B',
  tertiary: '#9A9A9A',
  disabled: '#BDBDBD',
  accent: '#8E6F5E',
  border: '#D8D3CB',
  surface: '#E4DFD6',
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
  } = data;

  const albumTitleShort = truncate(albumTitle, 44);
  const artistShort = truncate(artistName, 52);
  // OG : espace plus court, 2-3 lignes max
  const reviewExtract = reviewBody ? truncateSemantic(reviewBody, 120) : null;
  const formattedDate = formatDate(listenedAt);

  const image = (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: W,
        height: H,
        backgroundColor: C.bg,
        padding: PAD,
        fontFamily: 'Inter',
      }}
    >
      {/* ── Branding ── */}
      <div style={{ display: 'flex', marginBottom: 32 }}>
        <span
          style={{
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: '0.14em',
            color: C.tertiary,
            textTransform: 'uppercase',
          }}
        >
          Waveform
        </span>
      </div>

      {/* ── Corps : cover + contenu ── */}
      <div style={{ display: 'flex', flex: 1, gap: 52, alignItems: 'center' }}>
        {/* Cover */}
        {coverDataUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverDataUri}
            width={168}
            height={168}
            style={{ borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
            alt=""
          />
        ) : (
          <div
            style={{
              width: 168,
              height: 168,
              backgroundColor: C.surface,
              borderRadius: 10,
              flexShrink: 0,
              display: 'flex',
            }}
          />
        )}

        {/* Colonne droite */}
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
          {/* Titre + note */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 24,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              <span
                style={{
                  fontSize: 34,
                  fontWeight: 500,
                  color: C.text,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.2,
                }}
              >
                {albumTitleShort}
              </span>
              <span
                style={{ fontSize: 20, fontWeight: 400, color: C.secondary, lineHeight: 1.4 }}
              >
                {artistShort}
                {year ? `\u2002\u00B7\u2002${year}` : ''}
              </span>
            </div>

            {rating !== null && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 2,
                  flexShrink: 0,
                  paddingTop: 4,
                }}
              >
                <span style={{ fontSize: 30, fontWeight: 500, color: C.accent }}>{rating}</span>
                <span style={{ fontSize: 20, fontWeight: 400, color: C.tertiary }}>
                  {'\u2002/ 10'}
                </span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', height: 1, backgroundColor: C.border, marginTop: 20, marginBottom: 20 }} />

          {/* Extrait */}
          {reviewExtract ? (
            <span
              style={{
                fontSize: 21,
                fontWeight: 400,
                fontStyle: 'italic',
                color: C.text,
                lineHeight: 1.65,
              }}
            >
              {`\u00AB\u202F${reviewExtract}\u202F\u00BB`}
            </span>
          ) : (
            /* Pas de review : juste auteur + date plus visible */
            <span style={{ fontSize: 20, fontWeight: 400, color: C.secondary }}>
              {authorName}
            </span>
          )}

          {/* Spacer */}
          <div style={{ display: 'flex', flex: 1 }} />

          {/* Footer meta */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 16,
            }}
          >
            <span style={{ fontSize: 15, fontWeight: 400, color: C.tertiary }}>
              {authorName}
              {'\u2002\u00B7\u2002'}
              {formattedDate}
            </span>
            <span style={{ fontSize: 14, fontWeight: 400, color: C.disabled }}>waveform.app</span>
          </div>
        </div>
      </div>
    </div>
  );

  return new ImageResponse(image, {
    width: W,
    height: H,
    fonts: [
      { name: 'Inter', data: fonts.regular, weight: 400, style: 'normal' },
      { name: 'Inter', data: fonts.medium, weight: 500, style: 'normal' },
      { name: 'Inter', data: fonts.italic, weight: 400, style: 'italic' },
    ],
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
