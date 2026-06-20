'use client';

import { useEffect } from 'react';
import { markActivitySeen } from '@/app/actions/feed';
import { useAuth } from '@/lib/AuthContext';

export default function MarkActivitySeen() {
    const { refreshUnseenActivity } = useAuth();

    useEffect(() => {
        markActivitySeen().then(() => refreshUnseenActivity());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
}
