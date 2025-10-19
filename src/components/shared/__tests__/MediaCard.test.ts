import { render, screen } from '@testing-library/svelte';
import MediaCard from '../../shared/MediaCard.svelte';
import type { MediaItem } from '../../../types/tauri';
import { describe, it, expect } from 'vitest';

const sampleItem: MediaItem = {
  id: 'tt1234567',
  title: 'Inception',
  media_type: 'movie' as any,
  year: 2010,
  poster_url: 'https://via.placeholder.com/300x450?text=Poster',
  rating: 8.8,
  duration: 148, // minutes
} as any;

describe('MediaCard', () => {
  it('renders title and rating', () => {
    render(MediaCard, { props: { item: sampleItem, showProgress: true } });

    expect(screen.getByText('Inception')).toBeInTheDocument();
    expect(screen.getByText('8.8')).toBeInTheDocument();
  });
});