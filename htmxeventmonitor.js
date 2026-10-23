// Counter for HTMX events.
var htmxLogSequence = 1;

// Session variable names.
const HTMX_INIT = 'htmxDebugger.init';
const HTMX_EVENT_STORAGE_KEY = 'htmxDebugger.htmxEvents';
const HTMX_LOG_MAX = 'htmxDebugger.maxCount';

var defaultSettings = 
{
    maxCount: 200,
    events : 
    [
        { eventName: 'htmx:beforeRequest', eventEnabled: true },
        { eventName: 'htmx:beforeSend', eventEnabled: true },
        { eventName: 'htmx:afterOnLoad', eventEnabled: true },
        { eventName: 'htmx:afterRequest', eventEnabled: true },
        { eventName: 'htmx:responseError', eventEnabled: false },
        { eventName: 'htmx:sendError', eventEnabled: false} ,
        { eventName: 'htmx:timeout', eventEnabled: false} ,
        { eventName: 'htmx:beforeSwap', eventEnabled: false },
        { eventName: 'htmx:afterSwap', eventEnabled: false} ,
        { eventName: 'htmx:afterSettle', eventEnabled: false }
    ]
}

// Holds events that will be tracked.
var htmxEvents = [];
var maxLogs;

// Holds pameters that are passed in.  Needed for session reset.
var stashedParameters;


// Helper function.  Should probably use on other objects at some point.
function applyStyles(el, styles)
{
    Object.assign(el.style, styles);
}


// Hold styling info for header buttons.
const headerButtonStyles =
{
    padding: '0.25rem 0.50rem',
    margin: '0.25rem 0.50rem',
    backgroundColor: '#2f2f31f3',
    color: '#fff',
    border: 'none',
    borderRadius: '0.25rem',
    cursor: 'pointer',
    fontSize: '0.875rem'
};


// Generate the modal.
let settingsModal = null;

function createSettingsModal() {

    // Modal already exists — no need to recreate.
    if (settingsModal) {
        return settingsModal;
    }

    // Build the overlay.
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.zIndex = '999999';

    // Build the modal.
    const modal = document.createElement('div');
    modal.style.backgroundColor = '#fff';
    modal.style.borderRadius = '0.375rem';
    modal.style.maxWidth = '90vw';
    modal.style.width = '400px';
    modal.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    modal.style.fontFamily = 'sans-serif';

    const h6 = document.createElement('h6');
    h6.textContent = 'Toggle Monitored Events';
    Object.assign
    (
        h6.style,
        {
            margin: '0',
            fontSize: '1.1rem',
            fontWeight: '600',
            color: 'white'
        }
    );

    // Modal Header
    const mHeader = document.createElement('div');
    mHeader.style.padding = '1rem';
    mHeader.style.backgroundColor = '#141314';
    mHeader.style.borderBottom = '1px solid #dee2e6';
    mHeader.style.display = 'flex';
    mHeader.style.justifyContent = 'space-between';
    mHeader.style.alignItems = 'center';
    mHeader.textContent = '';
    mHeader.appendChild(h6);

    const closeModal = () => {
        overlay.remove();
        settingsModal = null;
    };

    const closeX = document.createElement('span');
    closeX.textContent = '🗙';
    closeX.style.color = 'white';
    closeX.style.cursor = 'pointer';
    closeX.style.fontSize = '1.5rem';
    closeX.style.fontWeight = 'bold';
    closeX.addEventListener('click', closeModal);
    mHeader.appendChild(closeX);

    // Build the modal body.
    const mBody = document.createElement('div');
    mBody.style.padding = '1rem';

    // Add the checkboxes.
    htmxEvents.forEach
    (
        eventObject =>
        {

            const row = document.createElement('label');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '0.5rem';
            row.style.marginBottom = '0.75rem';
            row.style.cursor = 'pointer';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = eventObject.eventEnabled;

            // Save checkbox state.
            checkbox.addEventListener
            (
                'change',
                (e) =>
                {
                    eventObject.eventEnabled = e.target.checked;
                    sessionStorage.setItem
                    (
                        HTMX_EVENT_STORAGE_KEY,
                        JSON.stringify(htmxEvents)
                    );

                    buildEvents();
                }
            );

            row.appendChild(checkbox);
            row.appendChild(document.createTextNode(eventObject.eventName));
            mBody.appendChild(row);
        }
    );

    modal.appendChild(mHeader);
    modal.appendChild(mBody);
    overlay.appendChild(modal);

    overlay.addEventListener
    (
        'click', (e) =>
        {
            if (e.target === overlay)
            {
                closeModal();
            }
        }
    );

    document.body.appendChild(overlay);

    settingsModal = overlay;

    return settingsModal;
}


function createLogElement(contentContainerInput, rerunHandler = null)
{
    const wrapper = document.createElement('p');
    wrapper.style.border = '1px solid #dee2e6';
    wrapper.style.padding = '0.75rem';
    wrapper.style.margin = '0.5rem 0';
    wrapper.style.borderRadius = '0.25rem';
    wrapper.style.position = 'relative';
    wrapper.style.paddingRight = '2rem';
    wrapper.style.backgroundColor = '#f8f9fa'; 

    // Increment the counter.
    const currentSeq = htmxLogSequence++;

    // Generate a time stamp.
    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

    const fragment = document.createDocumentFragment();

    const seqSpan = document.createElement('span');
    const strong = document.createElement('strong');
    strong.textContent = `#${currentSeq}`; 
    seqSpan.appendChild(strong);

    const timeSpan = document.createElement('span');
    timeSpan.textContent = `⏱ ${timestamp}`; 

    const rerunSpan = document.createElement('span');
    rerunSpan.textContent = '↻';

    // Style the rerun icon to look interactive
    if (typeof rerunHandler === 'function') {
        rerunSpan.style.cursor = 'pointer';
        rerunSpan.style.fontWeight = 'bold';
        rerunSpan.style.color = '#0d6efd';
        rerunSpan.title = 'Re-issue this HTMX request';
        // Attach the click event
        rerunSpan.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevents collapsing/expanding parent elements if attached
            rerunHandler();
        });
    } else {
        // Dim the icon if rerun metadata isn't available for this event
        rerunSpan.style.color = '#adb5bd';
        rerunSpan.style.cursor = 'not-allowed';
    }

    fragment.appendChild(seqSpan);
    fragment.appendChild(timeSpan);

    // Metadata header.
    const metaHeader = document.createElement('div');
    metaHeader.style.fontSize = '0.75rem';
    metaHeader.style.color = '#6c757d';
    metaHeader.style.marginBottom = '0.4rem';
    metaHeader.style.display = 'flex';
    metaHeader.style.gap = '1rem';
    metaHeader.textContent = ''; 
    metaHeader.appendChild(fragment);
    metaHeader.appendChild(rerunSpan);

    const contentContainer = document.createElement('div');
    if (contentContainerInput instanceof HTMLElement)
    {
        contentContainer.appendChild(contentContainerInput);
    }
    else
    {
        contentContainer.textContent = contentContainerInput;
    }

    // Put it together.
    wrapper.appendChild(metaHeader);
    wrapper.appendChild(contentContainer);

    // Close button
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '×';
    closeBtn.style.position = 'absolute';
    closeBtn.style.top = '0.5rem';
    closeBtn.style.right = '0.75rem';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.style.color = '#6c757d';
    closeBtn.style.fontSize = '1.25rem';
    closeBtn.style.lineHeight = '1';

    closeBtn.addEventListener('mouseenter', () => closeBtn.style.color = '#000');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.color = '#6c757d');

    closeBtn.addEventListener('click', () => wrapper.remove());

    wrapper.appendChild(closeBtn);
    return wrapper;
}


function prependToEventMonitor(logElement)
{
    const body = document.getElementById('event-monitor-body');
    
    // Don't do anything if the body doesn't exist.
    if (!body)
    {
        return;
    }

    if (body) 
    { 
        body.prepend(logElement);
    }

    // We can't let this thing grow forever.
    while (body.children.length > maxLogs)
    {
        body.lastElementChild.remove();
    }
}


function createEventMonitorContainer()
{
    const htmxEventMonitorContainer = document.createElement('div');
    htmxEventMonitorContainer.id = 'htmx-eventMonitor';
    htmxEventMonitorContainer.style.border = '1px solid rgba(0,0,0,.125)';
    htmxEventMonitorContainer.style.borderRadius = '0.25rem';
    htmxEventMonitorContainer.style.margin = '1rem';
    htmxEventMonitorContainer.style.fontFamily = 'sans-serif';
    htmxEventMonitorContainer.style.backgroundColor = '#fff';
    htmxEventMonitorContainer.style.display = 'flex';
    htmxEventMonitorContainer.style.flexDirection = 'column';

    htmxEventMonitorContainer.style.position = 'fixed';
    htmxEventMonitorContainer.style.left = '0';
    htmxEventMonitorContainer.style.right = '0';
    htmxEventMonitorContainer.style.bottom = '-420px'; 
    htmxEventMonitorContainer.style.height = '440px';
    htmxEventMonitorContainer.style.zIndex = '999998';
    htmxEventMonitorContainer.style.transition = 'bottom .25s ease';

    const cardHeader = document.createElement('div');
    cardHeader.style.padding = '0.25rem 0.50rem';
    cardHeader.style.backgroundColor = '#141314';
    cardHeader.style.borderBottom = '1px solid rgba(0,0,0,.125)';
    cardHeader.style.display = 'flex';
    cardHeader.style.justifyContent = 'space-between';
    cardHeader.style.cursor = 'pointer';

    const headerTitle = document.createElement('h5');
    headerTitle.innerText = 'HTMX EVENT MONITOR';
    headerTitle.style.margin = '0';
    headerTitle.style.fontSize = '1.00rem';
    headerTitle.style.fontWeight = '500';
    headerTitle.style.color = '#fff'

    const frontSpan = document.createElement('span')
    frontSpan.id = 'frontSpan'

    const backSpan = document.createElement('span')
    backSpan.id = 'backSpan'

    cardHeader.appendChild(frontSpan);
    cardHeader.appendChild(backSpan);

    const clearAllBtn = document.createElement('button');
    clearAllBtn.innerText = 'Clear All Logs';
    clearAllBtn.title = 'Clear all log messages.';
    applyStyles(clearAllBtn, headerButtonStyles);

    clearAllBtn.addEventListener
    (
        'click', () =>
        {
            // Don't reset htmxLogSequence to 0.
            cardBody.querySelectorAll('p').forEach(log => log.remove());
        }
    );

    // Open events modal button.
    const configBtn = document.createElement('button');
    configBtn.innerText = 'Events';
    configBtn.title = 'Select HTMX events to track';
    applyStyles(configBtn, headerButtonStyles);
    configBtn.addEventListener('click', createSettingsModal);

    // Button to clear the session variables.
    const clearSessionBtn = document.createElement('button');
    clearSessionBtn.innerText = 'Clear Session';
    clearSessionBtn.title = 'Clear the session variables holding the event monitor information.';
    applyStyles(clearSessionBtn, headerButtonStyles);
    clearSessionBtn.addEventListener
    (
        'click',
        () =>
        {
            sessionStorage.setItem(HTMX_INIT,'false');
            sessionStorage.removeItem(HTMX_EVENT_STORAGE_KEY);
            sessionStorage.removeItem(HTMX_INIT);
            sessionStorage.removeItem(HTMX_LOG_MAX)

            setSession(stashedParameters);

            // Set the events.
            htmxEvents = JSON.parse(sessionStorage.getItem(HTMX_EVENT_STORAGE_KEY));
            
            // Set max number.
            maxLogs = parseInt(sessionStorage.getItem(HTMX_LOG_MAX));

            // Force settings modal to close so it re-renders on open.
            if (settingsModal) 
            {
                settingsModal.remove();
                settingsModal = null;
            }

            buildEvents();
        }
    );

    // Put it together.
    frontSpan.appendChild(headerTitle);
    backSpan.appendChild(configBtn);
    backSpan.appendChild(clearAllBtn);
    backSpan.appendChild(clearSessionBtn);

    const cardBody = document.createElement('div');
    cardBody.id = 'event-monitor-body';
    cardBody.style.padding = '1.25rem';
    cardBody.style.overflowY = 'auto';

    htmxEventMonitorContainer.appendChild(cardHeader);
    htmxEventMonitorContainer.appendChild(cardBody);
    document.body.append(htmxEventMonitorContainer);

    let eventMonitorOpen = false;

    // Deal with opening and closing the event monitor.
    cardHeader.addEventListener
    (
        'click', (e) =>
        {

            if (e.target.closest('button'))
            {
                return;
            }

            eventMonitorOpen = !eventMonitorOpen;

            if (eventMonitorOpen)
            {

                if (settingsModal) {
                    settingsModal.remove();
                    settingsModal = null;
                }

                htmxEventMonitorContainer.style.bottom = '0';
            }
            else
            {
                htmxEventMonitorContainer.style.bottom = '-420px';
            }
        }
    );
}


function createDetailRow(label, value, targetNode = null)
{
    const fragment = document.createDocumentFragment();

    const strong = document.createElement('strong');
    strong.textContent = label + ': ';

    const valueSpan = document.createElement('span');
    valueSpan.textContent = value || 'None'; 

    // If an HTMX DOM element was passed in, attach the mouseover handler
    if (targetNode) {
        attachElementHighlight(valueSpan, targetNode);
    }

    fragment.appendChild(strong);
    fragment.appendChild(valueSpan);
    fragment.appendChild(document.createElement('br'));

    return fragment;
}


// A WeakMap to track active request context (timing and rerun information).
const htmxRequestStore = new WeakMap();

document.body.addEventListener
(
    'htmx:beforeRequest', 
    function(evt) 
    {
        const detail = evt.detail;
        if (!detail) return;

        const xhr = detail.xhr;
        const requestConfig = detail.requestConfig || {};
        const startTime = performance.now();

        const requestData = {
            startTime: startTime,
            verb: requestConfig.verb || 'GET',
            path: requestConfig.path || detail.path,
            target: detail.target || requestConfig.elt,
            values: requestConfig.parameters || {},
            headers: requestConfig.headers || {}
        };

        if (xhr) {
            // Store keyed to the XHR instance
            htmxRequestStore.set(xhr, requestData);
        } else {
            // Fallback: store directly on detail if XHR isn't initialized yet
            detail._requestData = requestData;
        }
    }
);


// Central handler for HTMX.
function handleHtmxEvent(evt) 
{
    // Store xhr data.
    const xhr = evt.detail?.xhr;

    // Fetch request context from WeakMap or detail fallback
    const requestData = xhr 
        ? htmxRequestStore.get(xhr) 
        : evt.detail?._requestData;

    // Calculate duration
    let durationText = 'N/A';
    if (requestData?.startTime) {
        const elapsed = performance.now() - requestData.startTime;
        durationText = `${elapsed.toFixed(1)} ms`;
    }

    // Build rerun callback
    let rerunHandler = null;
    if (requestData && requestData.path) {
        rerunHandler = () => {
            if (typeof htmx !== 'undefined') {
                htmx.ajax(requestData.verb, requestData.path, {
                    target: requestData.target,
                    values: requestData.values,
                    headers: requestData.headers
                });
            }
        };
    }

    

    // Stash the details so they are easy to access.
    const detail = evt.detail || {};
    const targetElement = detail.target;
    const triggerElement = detail.requestConfig?.elt || detail.elt;



    // Add infomation.
    // It would be nice to be able to pass this info in via the parameters.
    const container = document.createElement('div');
    container.appendChild(createDetailRow('Event Type', evt.type));
    container.appendChild(createDetailRow('Duration', durationText));
    container.appendChild(createDetailRow('Response Status', evt.detail.xhr?.status ?? 'Unknown'));
    //container.appendChild(createDetailRow('Target ID', evt.detail.target?.id));

    // Attach highlight to Target ID row
    container.appendChild(createDetailRow('Target ID', targetElement?.id || 'None', targetElement));

    
    
    // Build trigger text label
    let triggerLabel = 'None';
    if (triggerElement && triggerElement.tagName) {
        const tag = triggerElement.tagName.toLowerCase();
        const id = triggerElement.id ? `#${triggerElement.id}` : '';
        triggerLabel = `${tag}${id}`;
    }
    
    //const elt = evt.detail.requestConfig?.elt || evt.detail.elt;
    // let triggerLabel = 'None';
    // if (elt) 
    // {
    //     const tag = elt.tagName ? elt.tagName.toLowerCase() : '';
    //     const id = elt.id ? `#${elt.id}` : '';

    //     triggerLabel = `${tag}${id}` || 'Unknown Element';
    // }

    container.appendChild(createDetailRow('Trigger', triggerLabel, triggerElement));
    
    container.appendChild(createDetailRow('Verb', evt.detail.requestConfig?.verb??'Unknown'));
    container.appendChild(createDetailRow('Path', evt.detail.requestConfig?.path??'Unknown'));
    container.appendChild(createDetailRow('Response URL', evt.detail.xhr?.responseURL??'Unknown'));
    container.appendChild(createDetailRow('Boosted', evt.detail?.boosted??'false'));

    const log = createLogElement(container, rerunHandler);
    prependToEventMonitor(log);
}


// Highlighting targets could be useful.
function attachElementHighlight(labelElement, targetElement) 
{
    if (!targetElement || !(targetElement instanceof HTMLElement)) return;

    let originalOutline = '';
    let originalBoxShadow = '';

    labelElement.style.cursor = 'pointer';

    labelElement.addEventListener
    (
        'mouseenter', 
        () => 
        {
            if (!document.body.contains(targetElement)) 
            {
                labelElement.title = 'Element is no longer in the DOM';
                labelElement.style.textDecoration = 'line-through';
                return;
            }

            // Save original styles
            originalOutline = targetElement.style.outline;
            originalBoxShadow = targetElement.style.boxShadow;

            // Apply high-visibility highlight frame
            targetElement.style.outline = '2px solid #ff4757';
            targetElement.style.boxShadow = '0 0 8px rgba(255, 71, 87, 0.6)';
        }
    );

    labelElement.addEventListener
    (
        'mouseleave', 
        () => 
        {
            if (document.body.contains(targetElement)) 
            {
                targetElement.style.outline = originalOutline;
                targetElement.style.boxShadow = originalBoxShadow;
            }
            labelElement.title = '';
            labelElement.style.textDecoration = 'none';
        }
    );
}


// Loop through the register using keys.
function buildEvents()
{
    htmxEvents.forEach
    (
        eventObject =>
        {
            // Clean up.
            document.body.removeEventListener(eventObject.eventName, handleHtmxEvent);

            if (eventObject.eventEnabled === true)
            {
                document.body.addEventListener(eventObject.eventName, handleHtmxEvent);
            }
        }
    );
}


function setSession(parameters)
{
    // Have the session variables been set?
    if (!sessionStorage.getItem(HTMX_INIT))
    {
        sessionStorage.setItem(HTMX_INIT,'false');
    }

    // If the session variable haven't been initialized, roll on.
    if (sessionStorage.getItem(HTMX_INIT) === 'false')
    {
        // Set using parameters?
        if (typeof parameters === 'object' && parameters !== null)
        {
            sessionStorage.setItem
            (
                HTMX_EVENT_STORAGE_KEY,
                JSON.stringify(parameters.events)
            );

            sessionStorage.setItem (HTMX_LOG_MAX, parameters.maxCount);
        }
        else
        {
            // Fall back to hard set.
            const savedEvents = sessionStorage.getItem(HTMX_EVENT_STORAGE_KEY);

            if (!savedEvents)
            {
                // No saved events or a parameter passed in.
                sessionStorage.setItem
                (
                    HTMX_EVENT_STORAGE_KEY,
                    JSON.stringify(defaultSettings.events)
                );

                sessionStorage.maxCount = defaultSettings.maxCount;
            }
        }

        sessionStorage.setItem(HTMX_INIT,'true')
    }
}


// Let's not run initialization twice.
let initFinished = false;

function initHTMXEventMonitor(parameters)
{
    // This has already ran.  Don't do it again.
    if (initFinished) return;
    
    // Set flag so it won't run again.
    initFinished = true;

    // If parameters are passed in, stash them in case reset session button is activated.
    if (typeof parameters === 'object' && parameters !== null)
    {
        stashedParameters = parameters
    }
    else
    {
        stashedParameters = defaultSettings;
    }

    // Set session variables.
    setSession(parameters);

    // Set the events.
    htmxEvents = JSON.parse(sessionStorage.getItem(HTMX_EVENT_STORAGE_KEY));

    // Set max number.
    maxLogs = parseInt(sessionStorage.getItem(HTMX_LOG_MAX));

    createEventMonitorContainer();
    buildEvents();
}