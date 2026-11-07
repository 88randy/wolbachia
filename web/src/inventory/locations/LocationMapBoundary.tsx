import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
/** A renderer/chunk failure leaves the independently rendered scoped table available. */
export class LocationMapBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasFailed: boolean }
> {
  override state = { hasFailed: false };
  static getDerivedStateFromError() {
    return { hasFailed: true };
  }
  override componentDidCatch(error: Error, details: ErrorInfo) {
    console.error("Location map unavailable", error, details.componentStack);
  }
  override render() {
    return this.state.hasFailed ? this.props.fallback : this.props.children;
  }
}
