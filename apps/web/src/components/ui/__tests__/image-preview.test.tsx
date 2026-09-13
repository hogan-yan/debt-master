import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { optionalImagePreview } from '../image-preview';

describe('optionalImagePreview', () => {
  it('returns null when preview is missing', () => {
    const { container } = render(<>{optionalImagePreview(null, 'alt')}</>);
    expect(container.querySelector('img')).toBeNull();
  });

  it('renders an image when preview is present', () => {
    const { container } = render(<>{optionalImagePreview('data:image/png;base64,abc', 'alt')}</>);
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('data:image/png;base64,abc');
    expect(img?.getAttribute('alt')).toBe('alt');
  });
});
