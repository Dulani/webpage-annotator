document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const pageList = document.getElementById('page-list');
    const urlInput = document.getElementById('url-input');
    const fetchBtn = document.getElementById('fetch-btn');

    // App State
    let pagesData = {
        "page1": {
            title: "Sample Page 1",
            content: { ops: [{ insert: 'Welcome! You can edit this text and use the toolbar to format it, including highlighting sections by changing their background color.\n' }] },
            // Annotations are disabled for now.
            annotations: []
        },
    };
    let currentPageId = null;
    let quill = null;

    // --- State Management ---
    function saveState() {
        if (!quill || !currentPageId) return;
        pagesData[currentPageId].content = quill.getContents();
        try {
            localStorage.setItem('pagesData', JSON.stringify(pagesData));
        } catch (e) { console.error("Could not save state", e); }
    }

    function loadState() {
        try {
            const savedData = localStorage.getItem('pagesData');
            if (savedData) pagesData = JSON.parse(savedData);
        } catch (e) { console.error("Could not load state", e); }
    }

    // --- Page Loading and Rendering ---
    function renderPageList() {
        pageList.innerHTML = '';
        for (const pageId in pagesData) {
            const li = document.createElement('li');
            li.textContent = pagesData[pageId].title;
            li.dataset.pageId = pageId;
            li.addEventListener('click', () => loadPage(pageId));
            pageList.appendChild(li);
        }
    }

    function loadPage(pageId) {
        if (!pagesData[pageId] || !quill) return;
        currentPageId = pageId;
        quill.setContents(pagesData[pageId].content);
        Array.from(pageList.children).forEach(li => {
            li.classList.toggle('active', li.dataset.pageId === pageId);
        });
    }

    // --- URL Fetching ---
    async function fetchAndDisplayArticle() {
        const url = urlInput.value.trim();
        if (!url) { return alert('Please enter a URL.'); }
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        fetchBtn.textContent = 'Fetching...';
        fetchBtn.disabled = true;
        try {
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const html = await response.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const article = new Readability(doc).parse();
            if (article && article.content) {
                const tempQuill = new Quill(document.createElement('div'));
                tempQuill.clipboard.dangerouslyPasteHTML(article.content);
                const newPageId = `page-${Date.now()}`;
                pagesData[newPageId] = { title: article.title || 'Untitled Article', content: tempQuill.getContents(), annotations: [] };
                renderPageList();
                loadPage(newPageId);
                saveState();
            } else { alert('Could not extract article content.'); }
        } catch (error) { console.error('Error fetching article:', error); alert('Failed to fetch article.'); } finally {
            fetchBtn.textContent = 'Fetch & Annotate';
            fetchBtn.disabled = false;
        }
    }

    // --- Initial Setup ---
    function initialize() {
        loadState();
        const toolbarOptions = [
            [{ 'header': [1, 2, false] }],
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            // Use the standard background color picker for highlighting
            [{ 'background': ['rgba(255, 255, 0, 0.5)', 'rgba(255, 192, 203, 0.5)', 'rgba(173, 216, 230, 0.5)', false] }],
            ['clean']
        ];
        quill = new Quill('#editor', {
            theme: 'snow',
            modules: { toolbar: toolbarOptions }
        });

        // Autosave on text change
        quill.on('text-change', (delta, oldDelta, source) => {
            if (source === 'user') {
                clearTimeout(window.saveTimeout);
                window.saveTimeout = setTimeout(() => saveState(), 500);
            }
        });

        if(fetchBtn) fetchBtn.addEventListener('click', fetchAndDisplayArticle);

        renderPageList();
        const firstPageId = Object.keys(pagesData)[0];
        if (firstPageId) {
            loadPage(firstPageId);
        } else {
            quill.setText('No content.');
        }
    }

    initialize();
});
