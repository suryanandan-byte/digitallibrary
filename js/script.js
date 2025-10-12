// Wait for the HTML document to be fully loaded before running the script
document.addEventListener('DOMContentLoaded', () => {

    // Select the <ul> element inside the catalog section where we will display the books
    const catalogList = document.querySelector('#catalog-list');
    const orderSelect = document.getElementById('orderSelect');
    const searchInput = document.getElementById('catalogSearch');
    const searchBtn = document.getElementById('searchBtn');
    const categorySelect = document.getElementById('categorySelect');

    // The URL for the Gutendex API to fetch books.
    // We are asking for 32 books to nicely fill the space.
    const apiUrl = 'https://gutendex.com/books?limit=32';
    // In-memory cache of books fetched from the API
    let booksCache = [];

    // Function to fetch and display the books
    function loadBooks() {
        // Display a loading message while we fetch the data
        catalogList.innerHTML = '<li>Loading books...</li>';

        fetch(apiUrl)
            .then(response => {
                // Check if the request was successful
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(data => {
                // Clear the "Loading..." message
                catalogList.innerHTML = '';

                // Cache the books for sorting / re-rendering
                booksCache = data.results || [];

                // Populate category selector from books
                populateCategories(booksCache);

                // Render initial list using current order selection
                renderBooks();
            })
            .catch(error => {
                // If there's an error, display an error message
                console.error('Error fetching books:', error);
                catalogList.innerHTML = '<li>Sorry, could not load books at this time.</li>';
            });
    }

    // Sorting helpers
    function sortBooks(list, mode) {
        const copy = list.slice();
        switch (mode) {
            case 'title-asc':
                return copy.sort((a, b) => a.title.localeCompare(b.title));
            case 'title-desc':
                return copy.sort((a, b) => b.title.localeCompare(a.title));
            case 'author-asc':
                return copy.sort((a, b) => {
                    const aName = (a.authors && a.authors[0] && a.authors[0].name) || '';
                    const bName = (b.authors && b.authors[0] && b.authors[0].name) || '';
                    return aName.localeCompare(bName);
                });
            case 'downloads-desc':
                return copy.sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
            default:
                return copy;
        }
    }

    // Render books from cache applying current sort order and optional filter
    function renderBooks() {
        catalogList.innerHTML = '';
        if (!booksCache.length) {
            catalogList.innerHTML = '<li>No books available.</li>';
            return;
        }

    // Apply search filter if present
        const q = (searchInput && searchInput.value) ? searchInput.value.trim().toLowerCase() : '';
        let filtered = booksCache;
        if (q) {
            filtered = booksCache.filter(bk => {
                const title = (bk.title || '').toLowerCase();
                const author = (bk.authors && bk.authors[0] && bk.authors[0].name) ? bk.authors[0].name.toLowerCase() : '';
                return title.includes(q) || author.includes(q);
            });
        }

        // Apply category filter if selected
        const category = (categorySelect && categorySelect.value) ? categorySelect.value : '';
        if (category) {
            filtered = filtered.filter(bk => {
                // Check subjects and bookshelves for match
                const subjects = bk.subjects || [];
                const bookshelves = bk.bookshelves || [];
                const hasSub = subjects.some(s => s.toLowerCase() === category.toLowerCase());
                const hasShelf = bookshelves.some(s => s.toLowerCase() === category.toLowerCase());
                return hasSub || hasShelf;
            });
        }

        const ordered = sortBooks(filtered, orderSelect ? orderSelect.value : 'title-asc');

        ordered.forEach(book => {
            const listItem = document.createElement('li');
            listItem.classList.add('book-card');

            // Cover image (choose first image format available)
            const img = document.createElement('img');
            img.className = 'book-cover';
            img.loading = 'lazy';
            img.onerror = function () { this.onerror = null; this.src = placeholderDataUri(); };
            img.alt = (book.title || 'Book') + ' cover';
            img.src = pickImageFromFormats(book.formats);

            // Info container
            const info = document.createElement('div');
            info.className = 'book-info';

            const titleLink = document.createElement('a');
            let bookUrl = book.formats['text/html'] || book.formats['text/plain; charset=utf-8'] || '';
            if (bookUrl) {
                titleLink.href = bookUrl;
                titleLink.target = '_blank';
                titleLink.rel = 'noopener noreferrer';
            } else {
                titleLink.href = '#';
            }
            titleLink.className = 'book-title';
            titleLink.textContent = book.title || 'Untitled';

            const authorEl = document.createElement('div');
            authorEl.className = 'book-author';
            authorEl.textContent = (book.authors && book.authors[0] && book.authors[0].name) ? book.authors[0].name : '';

            info.appendChild(titleLink);
            if (authorEl.textContent) info.appendChild(authorEl);

            listItem.appendChild(img);
            listItem.appendChild(info);

            catalogList.appendChild(listItem);
        });
    }

    // Choose an image URL from the formats object; fall back to a tiny SVG placeholder
    function pickImageFromFormats(formats) {
        if (!formats || typeof formats !== 'object') return placeholderDataUri();
        // Look for any key that starts with 'image/' (e.g., 'image/jpeg')
        for (const key of Object.keys(formats)) {
            if (key && key.toLowerCase().startsWith('image/') && formats[key]) {
                return formats[key];
            }
        }
        // Some feeds provide 'cover' or similar keys — try to find typical image extensions
        for (const key of Object.keys(formats)) {
            const v = formats[key] || '';
            if (typeof v === 'string' && (v.endsWith('.jpg') || v.endsWith('.jpeg') || v.endsWith('.png'))) return v;
        }
        return placeholderDataUri();
    }

    function placeholderDataUri() {
        // Small inline SVG as a neutral placeholder
        const svg = encodeURIComponent(`
            <svg xmlns='http://www.w3.org/2000/svg' width='200' height='280' viewBox='0 0 200 280'>
              <rect width='100%' height='100%' fill='#775123' rx='6' />
              <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#fff' font-size='18' font-family='Arial, sans-serif'>No cover</text>
            </svg>`);
        return `data:image/svg+xml;charset=UTF-8,${svg}`;
    }

    // Populate category select with unique subjects/bookshelves
    function populateCategories(list) {
        if (!categorySelect) return;
        const set = new Set();
        list.forEach(bk => {
            (bk.subjects || []).forEach(s => set.add(s));
            (bk.bookshelves || []).forEach(s => set.add(s));
        });
        // Clear existing options except the first (All categories)
        const firstOpt = categorySelect.querySelector('option');
        categorySelect.innerHTML = '';
        if (firstOpt) categorySelect.appendChild(firstOpt);
        // Sort categories alphabetically
        Array.from(set).sort((a,b) => a.localeCompare(b)).forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = cat;
            categorySelect.appendChild(opt);
        });
        // Ensure the first option is "All categories"
        if (!categorySelect.querySelector('option')) {
            const opt = document.createElement('option'); opt.value = ''; opt.textContent = 'All categories'; categorySelect.appendChild(opt);
        }
    }

    // Wire up change event for ordering
    if (orderSelect) {
        orderSelect.addEventListener('change', () => {
            renderBooks();
        });
    }

    if (categorySelect) {
        categorySelect.addEventListener('change', () => renderBooks());
    }

    // Debounce helper
    function debounce(fn, wait) {
        let t = null;
        return function (...args) {
            clearTimeout(t);
            t = setTimeout(() => fn.apply(this, args), wait);
        };
    }

    // Wire up search behavior
    if (searchInput) {
        // Live search with debounce
        searchInput.addEventListener('input', debounce(() => renderBooks(), 250));

        // Enter key triggers search immediately
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                renderBooks();
            }
        });
    }

    if (searchBtn) {
        searchBtn.addEventListener('click', () => renderBooks());
    }

    // Call the function to load the books when the page loads
    loadBooks();

    // Mobile nav toggle
    const navToggleBtn = document.getElementById('navToggle');
    const mainNav = document.getElementById('mainNav');
    if (navToggleBtn && mainNav) {
        navToggleBtn.addEventListener('click', () => {
            const isOpen = mainNav.classList.toggle('open');
            navToggleBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });
    }
});