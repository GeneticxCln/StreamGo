// script_new.js

function loadPopularMovies() {
    if (typeof window.__TAURI__ !== 'undefined') {
        window.__TAURI__.invoke('search_movies_and_shows', { query: 'popular movies' })
            .then(movies => {
                const movieGrid = document.querySelector('.movie-grid');
                movieGrid.innerHTML = movies.map(movie => `
                    <div class="movie-item">
                        <img src="${movie.poster_url}" alt="${movie.title}">
                        <div class="movie-item-info">
                            <div class="movie-item-title">${movie.title}</div>
                            <div class="movie-item-year">${movie.year}</div>
                        </div>
                    </div>
                `).join('');
            })
            .catch(err => {
                console.error('Error fetching popular movies:', err);
            });
    }
}

function loadFeaturedMovie() {
    if (typeof window.__TAURI__ !== 'undefined') {
        window.__TAURI__.invoke('search_movies_and_shows', { query: 'featured movie' })
            .then(movies => {
                if (movies.length > 0) {
                    const featuredMovie = movies[0];
                    const heroSection = document.querySelector('.hero-section');
                    heroSection.style.backgroundImage = `url(${featuredMovie.backdrop_url})`;
                    
                    const heroContent = document.querySelector('.hero-content');
                    heroContent.innerHTML = `
                        <h2 class="hero-title">${featuredMovie.title}</h2>
                        <p class="hero-description">${featuredMovie.description}</p>
                        <button class="btn btn-primary">Watch Now</button>
                    `;
                }
            })
            .catch(err => {
                console.error('Error fetching featured movie:', err);
            });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('New UI loaded');
    loadPopularMovies();
    loadFeaturedMovie();
});
