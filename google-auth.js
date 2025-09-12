const CLIENT_ID = '20752164254-oepmsepmaht3sqlalvmt112q3p7p159r.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/documents';
const DOCS_DISCOVERY_URL = 'https://docs.googleapis.com/$discovery/rest?version=v1';

let tokenClient;
let gapiInited = false;

const statusDiv = document.getElementById('status');
const authorizeButton = document.getElementById('authorize_button');
const signoutButton = document.getElementById('signout_button');
const createDocButton = document.getElementById('create_doc_button');

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
                statusDiv.textContent = 'Authorization successful!';
                maybeEnableButtons();
            } else {
                statusDiv.textContent = 'Authorization failed.';
            }
        },
    });
}

function maybeEnableButtons() {
    const accessToken = localStorage.getItem('g_access_token');
    if (accessToken && gapiInited) {
        authorizeButton.style.display = 'none';
        signoutButton.style.display = 'inline';
        createDocButton.style.display = 'inline';
    } else {
        authorizeButton.style.display = 'inline';
        signoutButton.style.display = 'none';
        createDocButton.style.display = 'none';
    }
}

function handleAuthClick() {
    if (tokenClient) {
        tokenClient.requestAccessToken();
    }
}

function handleSignoutClick() {
    const accessToken = localStorage.getItem('g_access_token');
    if (accessToken) {
        google.accounts.oauth2.revoke(accessToken, () => {
            console.log('Access token revoked.');
            localStorage.removeItem('g_access_token');
            gapi.client.setToken(null);
            statusDiv.textContent = 'Signed out.';
            maybeEnableButtons();
        });
    }
}

async function handleCreateDocClick() {
    try {
        statusDiv.textContent = 'Creating document...';
        const res = await gapi.client.docs.documents.create({
            title: 'My Test Document from Annotation App',
        });
        const docId = res.result.documentId;
        const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
        statusDiv.innerHTML = `Document created! <a href="${docUrl}" target="_blank">Open Document</a>`;
    } catch (err) {
        statusDiv.textContent = 'Error creating document: ' + err.message;
        console.error(err);
    }
}


window.onload = () => {
    // gapi.load is for the Google API Client Library
    gapi.load('client', gapiInit);

    // The GSI library is loaded via the <script> tag in the HTML,
    // and it doesn't have a specific load callback when used this way.
    // However, since its script tag is placed before this script,
    // the `google` object should be available.
    gisInit();

    authorizeButton.onclick = handleAuthClick;
    signoutButton.onclick = handleSignoutClick;
    createDocButton.onclick = handleCreateDocClick;

    maybeEnableButtons();
};
