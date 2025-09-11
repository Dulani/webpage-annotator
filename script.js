document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const pageList = document.getElementById('page-list');
    const urlInput = document.getElementById('url-input');
    const fetchBtn = document.getElementById('fetch-btn');
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const newPageBtn = document.getElementById('new-page-btn');

    // App State
    let pagesData = {};
    let pageOrder = [];
    let currentPageId = null;
    let quill = null;
    const artyom = new Artyom();
    const pageColors = ['#FFFFFF', '#FADAD6', '#FBF09B', '#D4F5A5', '#BCF5E8', '#D6F2FB', '#D2E1FC', '#E8DEF8', '#FCE4EC'];


    // --- State Management ---
    function saveState() {
        if (quill && currentPageId && pagesData[currentPageId]) {
            pagesData[currentPageId].content = quill.getContents();
        }
        try {
            localStorage.setItem('pagesData', JSON.stringify(pagesData));
            localStorage.setItem('pageOrder', JSON.stringify(pageOrder));
        } catch (e) { console.error("Could not save state", e); }
    }

    function loadState() {
        try {
            const savedData = localStorage.getItem('pagesData');
            const savedOrder = localStorage.getItem('pageOrder');

            if (savedData && Object.keys(JSON.parse(savedData)).length > 0) {
                pagesData = JSON.parse(savedData);
                if (savedOrder) {
                    let parsedOrder = JSON.parse(savedOrder);
                    pageOrder = parsedOrder.filter(id => pagesData[id]);
                } else {
                    pageOrder = Object.keys(pagesData);
                }
                Object.keys(pagesData).forEach(id => {
                    if (!pageOrder.includes(id)) {
                        pageOrder.push(id);
                    }
                });

            } else {
                const defaultPageId = 'page1';
                pagesData = {
                    [defaultPageId]: {
                        title: "Sample Page 1",
                        content: { ops: [{ insert: 'Welcome! You can edit this text and use the toolbar to format it, including highlighting sections by changing their background color.\n' }] },
                        color: pageColors[0]
                    }
                };
                pageOrder = [defaultPageId];
            }

            // Ensure all pages have a color
            Object.values(pagesData).forEach(page => {
                if (!page.color) {
                    page.color = pageColors[0];
                }
            });

        } catch (e) { console.error("Could not load state", e); }
    }

    // --- Page Management ---
    function renderPageList() {
        pageList.innerHTML = '';
        if (pageOrder.length === 0) {
            pageList.innerHTML = '<li>No pages available.</li>';
            if (quill) {
                quill.setText('Create a new page to get started.');
                currentPageId = null;
            }
            return;
        }
        pageOrder.forEach(pageId => {
            const page = pagesData[pageId];
            const li = document.createElement('li');
            li.style.backgroundColor = page.color;

            const titleSpan = document.createElement('span');
            titleSpan.textContent = page.title;
            titleSpan.className = 'page-title';
            titleSpan.addEventListener('dblclick', () => handleRename(pageId, titleSpan));
            li.appendChild(titleSpan);

            const colorBtn = document.createElement('button');
            colorBtn.innerHTML = '🎨';
            colorBtn.className = 'color-page-btn';
            colorBtn.title = 'Change color';
            colorBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleChangeColor(pageId);
            });
            li.appendChild(colorBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '×';
            deleteBtn.className = 'delete-page-btn';
            deleteBtn.title = 'Delete page';
            deleteBtn.dataset.pageId = pageId;
            li.appendChild(deleteBtn);

            li.dataset.pageId = pageId;
            li.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-page-btn')) handleDeletePage(e);
                else if (e.target.classList.contains('color-page-btn')) { /* already handled */ }
                else if (!e.target.classList.contains('rename-input')) loadPage(pageId);
            });
            pageList.appendChild(li);
        });

        // Update active class after rendering
        Array.from(pageList.children).forEach(li => {
            if (li.dataset && li.dataset.pageId) {
                li.classList.toggle('active', li.dataset.pageId === currentPageId)
            }
        });
    }

    function handleChangeColor(pageId) {
        const page = pagesData[pageId];
        const currentColor = page.color || pageColors[0];
        const currentColorIndex = pageColors.indexOf(currentColor);
        const nextColorIndex = (currentColorIndex + 1) % pageColors.length;
        page.color = pageColors[nextColorIndex];
        saveState();
        renderPageList();
    }

    function handleRename(pageId, titleSpan) {
        const currentTitle = pagesData[pageId].title;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentTitle;
        input.className = 'rename-input';
        titleSpan.replaceWith(input);
        input.focus();
        input.select();
        const saveRename = () => {
            const newTitle = input.value.trim();
            if (newTitle && newTitle !== currentTitle) {
                pagesData[pageId].title = newTitle;
                saveState();
            }
            renderPageList();
        };
        input.addEventListener('blur', saveRename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveRename();
            else if (e.key === 'Escape') renderPageList();
        });
    }

    function handleDeletePage(event) {
        event.stopPropagation();
        const pageIdToDelete = event.target.dataset.pageId;
        if (confirm(`Are you sure you want to delete "${pagesData[pageIdToDelete].title}"?`)) {
            delete pagesData[pageIdToDelete];
            pageOrder = pageOrder.filter(id => id !== pageIdToDelete);

            if (currentPageId === pageIdToDelete) {
                currentPageId = null;
                const nextPageId = pageOrder[0];
                if (nextPageId) {
                    loadPage(nextPageId);
                } else {
                    if (quill) quill.setText('Create a new page to get started.');
                }
            }
            saveState();
            renderPageList();
        }
    }

    function handleNewPage() {
        const newPageId = `page-${Date.now()}`;
        pagesData[newPageId] = { title: "Untitled Page", content: { ops: [{ insert: '\n' }] }, color: pageColors[0] };
        pageOrder.push(newPageId);
        saveState();
        renderPageList();
        loadPage(newPageId);
    }

    function loadPage(pageId) {
        if (!pagesData[pageId] || !quill) return;
        saveState(); // Save content of the currently active page.
        currentPageId = pageId;
        quill.setContents(pagesData[pageId].content);
        // Update active class on list items
        Array.from(pageList.children).forEach(li => {
            if (li.dataset && li.dataset.pageId) {
                li.classList.toggle('active', li.dataset.pageId === pageId);
            }
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
                pagesData[newPageId] = { title: article.title || 'Untitled Article', content: tempQuill.getContents(), color: pageColors[0] };
                pageOrder.push(newPageId);
                saveState();
                renderPageList();
                loadPage(newPageId);
            } else { alert('Could not extract article content.'); }
        } catch (error) { console.error('Error fetching article:', error); alert('Failed to fetch article.'); } finally {
            fetchBtn.textContent = 'Fetch & Annotate';
            fetchBtn.disabled = false;
        }
    }

    // --- Text-to-Speech ---
    function handlePlay() {
        if (artyom.isSpeaking()) {
            handleStop();
            setTimeout(startSpeech, 100);
        } else {
            startSpeech();
        }
    }

    function startSpeech() {
        const range = quill.getSelection();
        let textToSpeak;
        if (range && range.length > 0) {
            textToSpeak = quill.getText(range.index, range.length);
        } else {
            const startIndex = range ? range.index : 0;
            textToSpeak = quill.getText(startIndex);
        }

        if (!textToSpeak.trim()) {
            alert("No text to speak from the current position.");
            return;
        }

        artyom.say(textToSpeak, {
            onStart: () => {
                playBtn.style.display = 'none';
                pauseBtn.style.display = 'inline-block';
            },
            onEnd: () => {
                playBtn.style.display = 'inline-block';
                pauseBtn.style.display = 'none';
            }
        });
    }

    function handlePause() {
        artyom.shutUp();
        playBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
    }

    function handleStop() {
        artyom.shutUp();
        playBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
    }

    // --- Initial Setup ---
    function initialize() {
        loadState();
        artyom.initialize({ lang: "en-GB", continuous: false, debug: true, listen: false })
            .then(() => console.log("Artyom has been successfully initialized."))
            .catch((err) => console.error("Artyom could not be initialized:", err));

        const toolbarOptions = [
            [{ 'header': [1, 2, false] }], ['bold', 'italic', 'underline'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            [{ 'background': ['rgba(255, 255, 0, 0.5)', 'rgba(255, 192, 203, 0.5)', 'rgba(173, 216, 230, 0.5)', false] }],
            ['clean']
        ];
        quill = new Quill('#editor', { theme: 'snow', modules: { toolbar: toolbarOptions } });

        quill.on('text-change', () => {
            clearTimeout(window.saveTimeout);
            window.saveTimeout = setTimeout(() => saveState(), 500);
        });

        fetchBtn.addEventListener('click', fetchAndDisplayArticle);
        playBtn.addEventListener('click', handlePlay);
        pauseBtn.addEventListener('click', handlePause);
        stopBtn.addEventListener('click', handleStop);
        newPageBtn.addEventListener('click', handleNewPage);

        renderPageList();
        const firstPageId = pageOrder[0];
        if (firstPageId) {
            loadPage(firstPageId);
        } else {
            quill.setText('No content.');
        }

        const sortable = new Sortable(pageList, {
            draggable: 'li',
            handle: '.page-title'
        });

        sortable.on('sortable:stop', ({ oldIndex, newIndex }) => {
            if (oldIndex === newIndex) return;
            const movedPageId = pageOrder.splice(oldIndex, 1)[0];
            pageOrder.splice(newIndex, 0, movedPageId);
            saveState();
        });
    }

    initialize();
});
