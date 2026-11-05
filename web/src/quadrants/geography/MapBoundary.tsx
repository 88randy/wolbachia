import { Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { MapFallback } from "./MapFallback";
/** WebGL construction or lazy import errors cannot take away the coordinate workflow. */
export class MapBoundary extends Component<{ children: ReactNode }, { hasFailed: boolean }> {
  override state = { hasFailed: false };
  static getDerivedStateFromError() {
    return { hasFailed: true };
  }
  override componentDidCatch(error: Error, details: ErrorInfo) {
    console.error("Map unavailable", error, details.componentStack);
  }
  override render() {
    return this.state.hasFailed ? <MapFallback /> : this.props.children;
  }
}
