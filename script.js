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
    let pagesData = {
        "page1": {
            title: "Sample Page 1",
            content: { ops: [{ insert: 'Welcome! You can edit this text and use the toolbar to format it, including highlighting sections by changing their background color.\n' }] }
        },
    };
    let currentPageId = null;
    let quill = null;

    // --- State Management ---
    function saveState() {
        if (quill && currentPageId && pagesData[currentPageId]) {
            pagesData[currentPageId].content = quill.getContents();
        }
        try {
            localStorage.setItem('pagesData', JSON.stringify(pagesData));
        } catch (e) { console.error("Could not save state", e); }
    }

    function loadState() {
        try {
            const savedData = localStorage.getItem('pagesData');
            if (savedData && Object.keys(JSON.parse(savedData)).length > 0) {
                pagesData = JSON.parse(savedData);
            }
        } catch (e) { console.error("Could not load state", e); }
    }

    // --- Page Loading and Rendering ---
    function renderPageList() {
        pageList.innerHTML = '';
        if (Object.keys(pagesData).length === 0) {
            pageList.innerHTML = '<li>No pages available.</li>';
            return;
        }
        for (const pageId in pagesData) {
            const page = pagesData[pageId];
            const li = document.createElement('li');
            const titleSpan = document.createElement('span');
            titleSpan.textContent = page.title;
            titleSpan.className = 'page-title';

            titleSpan.addEventListener('dblclick', () => handleRename(pageId, titleSpan));

            li.appendChild(titleSpan);
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '×';
            deleteBtn.className = 'delete-page-btn';
            deleteBtn.dataset.pageId = pageId;
            li.appendChild(deleteBtn);
            li.dataset.pageId = pageId;

            li.addEventListener('click', (e) => {
                if (e.target.classList.contains('delete-page-btn')) {
                    handleDeletePage(e);
                } else if (!e.target.classList.contains('rename-input')) {
                    loadPage(pageId);
                }
            });
            pageList.appendChild(li);
        }
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
            saveState();
            renderPageList();
            if (currentPageId === pageIdToDelete) {
                quill.setText('Select a page or fetch a new one.');
                currentPageId = null;
            }
        }
    }

    function handleNewPage() {
        const newPageId = `page-${Date.now()}`;
        pagesData[newPageId] = { title: "Untitled Page", content: { ops: [{ insert: '\n' }] } };
        saveState();
        renderPageList();
        loadPage(newPageId);
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
                pagesData[newPageId] = { title: article.title || 'Untitled Article', content: tempQuill.getContents() };
                renderPageList();
                loadPage(newPageId);
                saveState();
            } else { alert('Could not extract article content.'); }
        } catch (error) { console.error('Error fetching article:', error); alert('Failed to fetch article.'); } finally {
            fetchBtn.textContent = 'Fetch & Annotate';
            fetchBtn.disabled = false;
        }
    }

    // --- Text-to-Speech ---
    function handlePlay() {
        console.log("handlePlay called");
        console.log("SpeechSynthesis status:", {
            speaking: speechSynthesis.speaking,
            paused: speechSynthesis.paused,
            pending: speechSynthesis.pending,
        });
        const voices = speechSynthesis.getVoices();
        if (voices.length === 0) {
            console.error("No speech synthesis voices available.");
            alert("No text-to-speech voices were found. Please check your OS settings.");
            return;
        }
        console.log("Available voices:", voices.map(v => v.name));
        if (speechSynthesis.speaking && speechSynthesis.paused) {
            console.log("Resuming speech...");
            speechSynthesis.resume();
        } else {
            console.log("Starting new speech...");
            const text = quill.getText();
            if (!text.trim()) {
                console.warn("No text to speak.");
                alert("There is no text in the editor to play.");
                return;
            }
            console.log("Text to speak (first 100 chars):", text.substring(0, 100) + "...");
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.onstart = () => console.log("Speech started.");
            utterance.onpause = () => console.log("Speech paused.");
            utterance.onresume = () => console.log("Speech resumed.");
            utterance.onerror = (event) => console.error("SpeechSynthesis Error", event);
            utterance.onend = () => {
                console.log("Speech finished.");
                playBtn.style.display = 'inline-block';
                pauseBtn.style.display = 'none';
            };
            speechSynthesis.cancel();
            speechSynthesis.speak(utterance);
        }
        playBtn.style.display = 'none';
        pauseBtn.style.display = 'inline-block';
    }

    function handlePause() {
        console.log("handlePause called");
        speechSynthesis.pause();
        playBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
    }

    function handleStop() {
        console.log("handleStop called");
        speechSynthesis.cancel();
        playBtn.style.display = 'inline-block';
        pauseBtn.style.display = 'none';
    }

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

        if(fetchBtn) fetchBtn.addEventListener('click', fetchAndDisplayArticle);
        playBtn.addEventListener('click', handlePlay);
        pauseBtn.addEventListener('click', handlePause);
        stopBtn.addEventListener('click', handleStop);
        newPageBtn.addEventListener('click', handleNewPage);

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
