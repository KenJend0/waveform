'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class DebugErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[DebugErrorBoundary] error:', error.message);
    console.error('[DebugErrorBoundary] componentStack:', info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      // Affiche les enfants tels quels — le vrai but est le log dans componentDidCatch
      return null;
    }
    return this.props.children;
  }
}
