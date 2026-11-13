import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FullscreenLoader } from '../fullscreen-loader';

describe('FullscreenLoader', () => {
  it('renders with default message', () => {
    render(<FullscreenLoader />);
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders with custom message', () => {
    render(<FullscreenLoader message="Please wait" />);
    expect(screen.getByText('Please wait')).toBeInTheDocument();
  });
});
