document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const pageList = document.getElementById('page-list');
    const urlInput = document.getElementById('url-input');
    const fetchBtn = document.getElementById('fetch-btn');
    const commentSidebar = document.querySelector('.comment-sidebar');
    const commentInput = document.getElementById('comment-input');
    const saveCommentBtn = document.getElementById('save-comment-btn');
    const cancelCommentBtn = document.getElementById('cancel-comment-btn');

    // App State
    let pagesData = {
        "page1": {
            title: "Sample Page 1",
            content: { ops: [{ insert: 'Welcome! You can edit this text, use the toolbar to format it, highlight sections by changing their background color, and then click on a highlight to add a comment.\n' }] },
            annotations: []
        },
    };
    let currentPageId = null;
    let quill = null;
    let activeAnnotationId = null;

    // --- Quill Customization ---
    const Parchment = Quill.import('parchment');
    const AnnotationIdAttributor = new Parchment.Attributor.Attribute('annotationId', 'data-annotation-id', {
        scope: Parchment.Scope.INLINE
    });
    Quill.register(AnnotationIdAttributor);

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
        // Disable the selection-change listener during load to prevent premature triggers
        quill.off('selection-change', selectionChangeHandler);
        quill.setContents(pagesData[pageId].content);
        quill.on('selection-change', selectionChangeHandler);

        Array.from(pageList.children).forEach(li => {
            li.classList.toggle('active', li.dataset.pageId === pageId);
        });
        closeCommentSidebar();
    }

    // --- Commenting UI ---
    function showCommentSidebar(annotationId) {
        activeAnnotationId = annotationId;
        const annotation = pagesData[currentPageId].annotations.find(a => a.id === annotationId);
        if (annotation) {
            commentInput.value = annotation.comment;
            commentSidebar.style.display = 'block';
            commentInput.focus();
        }
    }

    function closeCommentSidebar() {
        commentSidebar.style.display = 'none';
        activeAnnotationId = null;
        commentInput.value = '';
    }

    function saveComment() {
        if (!activeAnnotationId) return;
        const annotation = pagesData[currentPageId].annotations.find(a => a.id === activeAnnotationId);
        if (annotation) {
            annotation.comment = commentInput.value;
            saveState();
        }
        closeCommentSidebar();
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

    // --- Event Handlers ---
    const selectionChangeHandler = (range, oldRange, source) => {
        if (source === 'user' && range && range.length === 0) { // A click or cursor move
            const formats = quill.getFormat(range.index);
            if (formats.background) {
                if (formats.annotationId) {
                    showCommentSidebar(formats.annotationId);
                } else {
                    // This is a new highlight. Let's create an annotation for it.
                    const newId = `anno-${Date.now()}`;
                    // Find the bounds of the entire highlighted section
                    const [leaf, offset] = quill.getLeaf(range.index);
                    const blotRange = {
                        index: range.index - offset,
                        length: leaf.length()
                    };
                    // Apply the ID to the whole blot
                    quill.formatText(blotRange.index, blotRange.length, 'annotationId', newId, 'silent');

                    if (!pagesData[currentPageId].annotations) pagesData[currentPageId].annotations = [];
                    pagesData[currentPageId].annotations.push({ id: newId, comment: '' });
                    saveState();
                    showCommentSidebar(newId);
                }
            } else {
                closeCommentSidebar();
            }
        }
    };

    // --- Initial Setup ---
    function initialize() {
        loadState();
        const toolbarOptions = [
            [{ 'header': [1, 2, false] }],
            ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'background': ['rgba(255, 255, 0, 0.5)', 'rgba(255, 192, 203, 0.5)', 'rgba(173, 216, 230, 0.5)', false] }],
            ['clean']
        ];
        quill = new Quill('#editor', {
            theme: 'snow',
            modules: { toolbar: toolbarOptions }
        });

        quill.on('text-change', (delta, oldDelta, source) => {
            if (source === 'user') {
                clearTimeout(window.saveTimeout);
                window.saveTimeout = setTimeout(() => saveState(), 500);
            }
        });

        quill.on('selection-change', selectionChangeHandler);

        if(fetchBtn) fetchBtn.addEventListener('click', fetchAndDisplayArticle);
        saveCommentBtn.addEventListener('click', saveComment);
        cancelCommentBtn.addEventListener('click', closeCommentSidebar);

        renderPageList();
        const firstPageId = Object.keys(pagesData)[0];
        if (firstPageId) loadPage(firstPageId); else quill.setText('No content.');
    }

    initialize();
});
