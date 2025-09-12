window.onload = () => {
    // DOM Elements
    const pageList = document.getElementById('page-list');
    const urlInput = document.getElementById('url-input');
    const fetchBtn = document.getElementById('fetch-btn');
    const playBtn = document.getElementById('play-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const stopBtn = document.getElementById('stop-btn');
    const newPageBtn = document.getElementById('new-page-btn');
    const authorizeButton = document.getElementById('authorize_button');
    const signoutButton = document.getElementById('signout_button');
    const exportButton = document.getElementById('export_button');

    // App State
    let pagesData = {};
    let pageOrder = [];
    let currentPageId = null;
    let quill = null;
    const artyom = new Artyom();
    const pageColors = ['#FFFFFF', '#FADAD6', '#FBF09B', '#D4F5A5', '#BCF5E8', '#D6F2FB', '#D2E1FC', '#E8DEF8', '#FCE4EC'];

    // Google API State
    const CLIENT_ID = '20752164254-oepmsepmaht3sqlalvmt112q3p7p159r.apps.googleusercontent.com';
    const SCOPES = 'https://www.googleapis.com/auth/documents';
    const DOCS_DISCOVERY_URL = 'https://docs.googleapis.com/$discovery/rest?version=v1';
    let tokenClient;
    let gapiInited = false;
    let gisInited = false;

    // --- Helper Functions ---
    function parseRgba(rgba) {
        const result = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (!result) return null;
        return {
            red: parseInt(result[1], 10) / 255,
            green: parseInt(result[2], 10) / 255,
            blue: parseInt(result[3], 10) / 255,
        };
    }

    function convertQuillToDocsRequests(delta) {
        const requests = [];
        let currentIndex = 1;

        delta.ops.forEach(op => {
            if (typeof op.insert !== 'string') return;

            const text = op.insert;
            const textLength = text.length;

            // 1. Insert the text
            requests.push({
                insertText: {
                    location: { index: currentIndex },
                    text: text,
                },
            });

            // 2. Apply formatting if any
            if (op.attributes) {
                const textStyle = {};
                let fields = [];

                if (op.attributes.bold) { textStyle.bold = true; fields.push('bold'); }
                if (op.attributes.italic) { textStyle.italic = true; fields.push('italic'); }
                if (op.attributes.underline) { textStyle.underline = true; fields.push('underline'); }

                if (op.attributes.background) {
                    const rgbColor = parseRgba(op.attributes.background);
                    if (rgbColor) {
                        textStyle.backgroundColor = { color: { rgbColor } };
                        fields.push('backgroundColor');
                    }
                }

                if (fields.length > 0) {
                    requests.push({
                        updateTextStyle: {
                            range: {
                                startIndex: currentIndex,
                                endIndex: currentIndex + textLength,
                            },
                            textStyle: textStyle,
                            fields: fields.join(','),
                        },
                    });
                }
            }

            currentIndex += textLength;
        });

        return requests;
    }

    // --- Google API Functions ---
    function gapiInit() {
        gapi.client.init({
            discoveryDocs: [DOCS_DISCOVERY_URL],
        }).then(() => {
            gapiInited = true;
            maybeEnableButtons();
        });
    }

    function gisInit() {
        tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (tokenResponse) => {
                if (tokenResponse && tokenResponse.access_token) {
                    localStorage.setItem('g_access_token', tokenResponse.access_token);
                    gapi.client.setToken({ access_token: tokenResponse.access_token });
                    maybeEnableButtons();
                }
            },
        });
        gisInited = true;
        maybeEnableButtons();
    }

    function maybeEnableButtons() {
        const accessToken = localStorage.getItem('g_access_token');
        if (accessToken && gapiInited && gisInited) {
            authorizeButton.style.display = 'none';
            signoutButton.style.display = 'inline';
            exportButton.style.display = 'inline';
        } else {
            authorizeButton.style.display = 'inline';
            signoutButton.style.display = 'none';
            exportButton.style.display = 'none';
        }
    }

    function handleAuthClick() {
        if (tokenClient) {
            tokenClient.requestAccessToken({prompt: 'consent'});
        }
    }

    function handleSignoutClick() {
        const accessToken = localStorage.getItem('g_access_token');
        if (accessToken) {
            google.accounts.oauth2.revoke(accessToken, () => {
                localStorage.removeItem('g_access_token');
                gapi.client.setToken(null);
                maybeEnableButtons();
            });
        }
    }

    async function handleExportToDocsClick() {
        if (!currentPageId || !pagesData[currentPageId]) {
            alert('Please select a page to export.');
            return;
        }

        const page = pagesData[currentPageId];
        const pageTitle = page.title;
        const delta = quill.getContents();

        try {
            exportButton.textContent = 'Exporting...';
            exportButton.disabled = true;

            const doc = await gapi.client.docs.documents.create({
                title: pageTitle,
            });

            const docId = doc.result.documentId;
            const requests = convertQuillToDocsRequests(delta);

            if (requests.length > 0) {
                await gapi.client.docs.documents.batchUpdate({
                    documentId: docId,
                    requests: requests,
                });
            }

            const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
            alert(`Document created successfully!`);
            window.open(docUrl, '_blank');

        } catch (err) {
            alert('Error creating document: ' + err.message);
            console.error(err);
        } finally {
            exportButton.textContent = 'Export to Google Docs';
            exportButton.disabled = false;
        }
    }


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
        saveState();
        currentPageId = pageId;
        quill.setContents(pagesData[pageId].content);
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
        // Load local data first
        loadState();

        // Init Google Auth
        gapi.load('client', gapiInit);
        gisInit();

        // Init Artyom
        artyom.initialize({ lang: "en-GB", continuous: false, debug: true, listen: false })
            .then(() => console.log("Artyom has been successfully initialized."))
            .catch((err) => console.error("Artyom could not be initialized:", err));

        // Init Quill
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

        // Add event listeners
        fetchBtn.addEventListener('click', fetchAndDisplayArticle);
        playBtn.addEventListener('click', handlePlay);
        pauseBtn.addEventListener('click', handlePause);
        stopBtn.addEventListener('click', handleStop);
        newPageBtn.addEventListener('click', handleNewPage);
        authorizeButton.addEventListener('click', handleAuthClick);
        signoutButton.addEventListener('click', handleSignoutClick);
        exportButton.addEventListener('click', handleExportToDocsClick);

        // Final UI setup
        renderPageList();
        const firstPageId = pageOrder[0];
        if (firstPageId) {
            loadPage(firstPageId);
        } else {
            quill.setText('No content.');
        }

        const sortable = new Draggable.Sortable(pageList, {
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
};
