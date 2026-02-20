import { NextRequest, NextResponse } from 'next/server';
import { getAvatarIndex } from '@/lib/getAvatarIndex';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const index = getAvatarIndex(userId);

    // Dynamic import to avoid bundling react-dom/server at module level
    const ReactDOMServer = (await import('react-dom/server')).default;
    const avatars = await import('@/components/avatars/avatars');
    const AVATARS = [
      avatars.Avatar01, avatars.Avatar02, avatars.Avatar03,
      avatars.Avatar04, avatars.Avatar05, avatars.Avatar06,
      avatars.Avatar07, avatars.Avatar08, avatars.Avatar09,
      avatars.Avatar10, avatars.Avatar11, avatars.Avatar12,
    ];

    const AvatarComponent = AVATARS[index];

    if (!AvatarComponent) {
      return NextResponse.json(
        { error: 'Avatar not found' },
        { status: 404 }
      );
    }

    const svgString = ReactDOMServer.renderToStaticMarkup(
      <div className="w-full h-full bg-background-tertiary">
        <AvatarComponent />
      </div>
    );

    return new NextResponse(svgString, {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Avatar generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate avatar' },
      { status: 500 }
    );
  }
}
