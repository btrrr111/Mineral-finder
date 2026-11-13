// Hello!! i hope you enjoy this tool, i think it is pretty awesome if i do say so myself
// Bonjour tout le monde, j'espère que vous aimes mon petit projet, et si vous avez des recommendations pour modifier quelque chose dans ce code, n'hésitez pas de me contacter!!
let mineralDataset = [];
let activeFiltersCount = 0;
const filterCookieName = "mineral_finder_filters";

// Column list configuration, it was kinda annoying to find ALL these categories, but i figured... why not use the already existing wikipedia database!!! so i did and it was pretty easy i guess
const csvColumns = [
    "Category", "Group", "Formula", "IMA status", "Crystal system", 
    "Crystal class", "Space group", "Color", "Crystal habit", "Twinning", 
    "Cleavage", "Fracture", "Mohs scale", "Luster", "Streak", "Diaphaneity", 
    "Specific gravity", "Optical properties", "Refractive index", "Birefringence", 
    "Paleochroism", "Melting point", "Solubility", "Common impurities", "Other characteristics"
];

// Document Elements
const filterToggleBtn = document.getElementById("filter-toggle-btn");
const filterPanel = document.getElementById("filter-panel");
const nameSearchInput = document.getElementById("name-search");
const searchSubmitBtn = document.getElementById("search-submit-btn");
const resetFilterBtn = document.getElementById("reset-filter-btn");
const mohsSlider = document.getElementById("mohs-slider");
const mohsValDisplay = document.getElementById("mohs-val");
const contentArea = document.getElementById("content-area");


document.addEventListener("DOMContentLoaded", () => {
    initFiltersUI();
    loadDataset();
});

// Setup filters UI click structures and sync cookie profiles
function initFiltersUI() {
    filterToggleBtn.addEventListener("click", () => {
        const isHidden = window.getComputedStyle(filterPanel).display === "none";
        if (isHidden) {
            filterPanel.style.display = "block";
            filterToggleBtn.textContent = "Filter";
        } else {
            filterPanel.style.display = "none";
            updateFilterButtonBadge();
        }
    });

    mohsSlider.addEventListener("input", (e) => {
        mohsValDisplay.textContent = e.target.value == 0 ? "Any" : e.target.value;
        saveFiltersToCookies();
    });

    filterPanel.addEventListener("change", () => {
        saveFiltersToCookies();
        updateFilterButtonBadge();
    });

    resetFilterBtn.addEventListener("click", () => {
        resetAllFilters();
    });

    searchSubmitBtn.addEventListener("click", () => {
        executeSearch();
    });

    nameSearchInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") executeSearch();
    });
}

// Client-side Fetch & Structural Parsing of local database
async function loadDataset() {
    try {
        const response = await fetch("minerals_with_all_properties.csv");
        if (!response.ok) throw new Error("Could not acquire CSV dataset asset.");
        const rawText = await response.text();
        
        parseCSVData(rawText);
        readFiltersFromCookies();
        updateFilterButtonBadge();
    } catch (err) {
        console.error("Dataset load issue: ", err);
        contentArea.innerHTML = `<div class="welcome-message"><h3>Error loading database file</h3><p>Ensure minerals_with_all_properties.csv is located in the root folder.</p></div>`;
    }
}

// Parsing the CSV that contains those mineral properties
function parseCSVData(text) {
    const lines = [];
    let row = [""];
    let inQuotes = false;
    
    for (let i = 0; i < text.length; i++) {
        let c = text[i];
        let next = text[i+1];
        if (c === '"') {
            if (inQuotes && next === '"') { row[row.length - 1] += '"'; i++; }
            else { inQuotes = !inQuotes; }
        } else if (c === ',' && !inQuotes) {
            row.push('');
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
            if (c === '\r' && next === '\n') { i++; }
            lines.push(row);
            row = [''];
        } else {
            row[row.length - 1] += c;
        }
    }
    if (row.length > 1 || row[0] !== '') lines.push(row);
    if (lines.length === 0) return;

    const fileHeaders = lines[0].map(h => h.trim());
    
    for (let r = 1; r < lines.length; r++) {
        const rowData = lines[r];
        if (rowData.length <= 1 && rowData[0] === '') continue;
        
        let mineralObj = {};
        mineralObj["Name"] = rowData[0] ? rowData[0].trim() : "Unknown Mineral";
        
        csvColumns.forEach((col, idx) => {
            let val = rowData[idx + 1]; 
            mineralObj[col] = val ? val.trim() : "Unknown";
        });
        
        mineralDataset.push(mineralObj);
    }
    
}

function executeSearch() {
    
    const queryTerm = nameSearchInput.value.trim();
    const activeFilters = compileActiveFilters();
    
    filterPanel.style.display = "none";
    updateFilterButtonBadge();

    if (queryTerm && Object.keys(activeFilters).length === 0) {
        const exactMatch = mineralDataset.find(m => m.Name.toLowerCase() === queryTerm.toLowerCase());
        if (exactMatch) {
            renderMineralProfileView(exactMatch);
            return;
        }
    }

    let filteredResults = mineralDataset.filter(mineral => {
        
        if (mineral === mineralDataset[0]) {
            console.log("👉 REAL CSV HEADERS DETECTED:", Object.keys(mineral));
            console.log("👉 ACTIVE FILTERS APPLIED:", activeFilters);
        }

        for (let criteria in activeFilters) {
            let userSelection = activeFilters[criteria];
            if (!userSelection || userSelection === "" || userSelection === "all" || userSelection === "any") {
                continue;
            }

            let realCSVKey = Object.keys(mineral).find(
                key => key.toLowerCase().trim() === criteria.toLowerCase().trim()
            );

            if (!realCSVKey) {
                console.warn(`⚠️ Filter mismatch: UI requested "${criteria}", but no matching column exists in your CSV!`);
                continue; 
            }

            let dataValue = mineral[realCSVKey];

            if (!dataValue || dataValue.toString().trim().toLowerCase() === "unknown" || dataValue.toString().trim() === "") {
                return false; 
            }

            dataValue = dataValue.toString().trim();

            if (realCSVKey.toLowerCase().includes("mohs") || realCSVKey.toLowerCase().includes("hardness")) {
                let firstMatch = dataValue.match(/[\d.]+/);
                let numericValue = firstMatch ? parseFloat(firstMatch[0]) : NaN;
                
                if (!isNaN(numericValue) && numericValue < parseFloat(userSelection)) {
                    return false;
                }
            } else if (Array.isArray(userSelection)) {
                let matchedItem = userSelection.some(selectedVal => 
                    dataValue.toLowerCase().includes(selectedVal.toString().trim().toLowerCase())
                );
                if (!matchedItem) return false;
            } else {
                if (!dataValue.toLowerCase().includes(userSelection.toString().trim().toLowerCase())) {
                    return false;
                }
            }
        }

        if (queryTerm) {
            let nameKey = Object.keys(mineral).find(k => k.toLowerCase() === "name") || "Name";
            let mineralName = mineral[nameKey] ? mineral[nameKey].toString().toLowerCase() : "";
            
            if (!mineralName.includes(queryTerm.toLowerCase())) {
                return false;
            }
        }
        return true;
    });

    let suggestedMineral = null;
    if (filteredResults.length === 0 && queryTerm) {
        suggestedMineral = locateClosestOrthography(queryTerm);
    }

    renderSearchResultsView(filteredResults, suggestedMineral);
}


function compileActiveFilters() {
    let filters = {};

    // Crystal System
    let systemRadio = document.querySelector('input[name="crystal_system"]:checked');
    if (systemRadio) filters["Crystal system"] = systemRadio.value;

    // Color Checkboxes
    let checkedColors = Array.from(document.querySelectorAll('input[name="color"]:checked')).map(el => el.value);
    if (checkedColors.length > 0) filters["Color"] = checkedColors;

    // Twinning
    let twinRadio = document.querySelector('input[name="twinning"]:checked');
    if (twinRadio) filters["Twinning"] = twinRadio.value;

    // Cleavage
    let cleavageRadio = document.querySelector('input[name="cleavage"]:checked');
    if (cleavageRadio) filters["Cleavage"] = cleavageRadio.value;

    // Mohs Hardness Scale Slider (shoutout mohs!!!)
    if (parseFloat(mohsSlider.value) > 0) {
        filters["Mohs scale"] = mohsSlider.value;
    }

    // Luster Checkboxes
    let checkedLusters = Array.from(document.querySelectorAll('input[name="luster"]:checked')).map(el => el.value);
    if (checkedLusters.length > 0) filters["Luster"] = checkedLusters;

    // Streak
    let streakRadio = document.querySelector('input[name="streak"]:checked');
    if (streakRadio) filters["Streak"] = streakRadio.value;

    return filters;
}

function updateFilterButtonBadge() {
    const filters = compileActiveFilters();
    activeFiltersCount = Object.keys(filters).length;
    
    const isHidden = window.getComputedStyle(filterPanel).display === "none";
    if (isHidden && activeFiltersCount > 0) {
        filterToggleBtn.textContent = `Filter (${activeFiltersCount})`;
    } else {
        filterToggleBtn.textContent = "Filter";
    }
}

function resetAllFilters() {
    document.querySelectorAll('#filter-panel input[type="radio"]').forEach(el => el.checked = false);
    document.querySelectorAll('#filter-panel input[type="checkbox"]').forEach(el => el.checked = false);
    mohsSlider.value = 0;
    mohsValDisplay.textContent = "Any";
    
    saveFiltersToCookies();
    updateFilterButtonBadge();
}

function saveFiltersToCookies() {
    const filters = compileActiveFilters();
    const expirationDays = 7;
    const date = new Date();
    date.setTime(date.getTime() + (expirationDays * 24 * 60 * 60 * 1000));
    
    document.cookie = `${filterCookieName}=${encodeURIComponent(JSON.stringify(filters))};expires=${date.toUTCString()};path=/`;
}

function readFiltersFromCookies() {
    const match = document.cookie.match(new RegExp('(^| )' + filterCookieName + '=([^;]+)'));
    if (!match) return;
    
    try {
        const filters = JSON.parse(decodeURIComponent(match[2]));
        
        if (filters["Crystal system"]) {
            let el = document.querySelector(`input[name="crystal_system"][value="${filters["Crystal system"]}"]`);
            if (el) el.checked = true;
        }
        if (filters["Color"]) {
            filters["Color"].forEach(val => {
                let el = document.querySelector(`input[name="color"][value="${val}"]`);
                if (el) el.checked = true;
            });
        }
        if (filters["Twinning"]) {
            let el = document.querySelector(`input[name="twinning"][value="${filters["Twinning"]}"]`);
            if (el) el.checked = true;
        }
        if (filters["Cleavage"]) {
            let el = document.querySelector(`input[name="cleavage"][value="${filters["Cleavage"]}"]`);
            if (el) el.checked = true;
        }
        if (filters["Mohs scale"]) {
            mohsSlider.value = filters["Mohs scale"];
            mohsValDisplay.textContent = filters["Mohs scale"];
        }
        if (filters["Luster"]) {
            filters["Luster"].forEach(val => {
                let el = document.querySelector(`input[name="luster"][value="${val}"]`);
                if (el) el.checked = true;
            });
        }
        if (filters["Streak"]) {
            let el = document.querySelector(`input[name="streak"][value="${filters["Streak"]}"]`);
            if (el) el.checked = true;
        }
    } catch (e) {
        console.error("Cookie reconstruction fault:", e);
    }
}

async function fetchWikipediaMedia(mineralName) {
    if (!navigator.onLine) return null;
    
    try {
        const formattedName = encodeURIComponent(mineralName.trim().replace(/ /g, '_'));
        const endpoint = `https://en.wikipedia.org/api/rest_v1/page/summary/${formattedName}`;
        
        const res = await fetch(endpoint);
        
        if (!res.ok) return null;
        const json = await res.json();
        return {
            thumbnail: json.thumbnail ? json.thumbnail.source : null,
            wikiUrl: json.content_urls ? json.content_urls.desktop.page : `https://en.wikipedia.org/wiki/${formattedName}`
        };
    } catch (e) {
        return null;
    }
}

async function renderSearchResultsView(results, suggestion) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    contentArea.innerHTML = "";

    if (suggestion) {
        const suggestionBanner = document.createElement("div");
        suggestionBanner.className = "suggestion-banner";
        suggestionBanner.innerHTML = `Spelling notification: Did you mean <span class="suggestion-link" id="spell-suggest">${suggestion.Name}</span>?`;
        contentArea.appendChild(suggestionBanner);
        
        document.getElementById("spell-suggest").addEventListener("click", () => {
            renderMineralProfileView(suggestion);
        });
    }

    if (results.length === 0 && !suggestion) {
        contentArea.innerHTML = `<div class="welcome-message"><h3>No Mineral Records Located</h3><p>Adjust parameters or check entry spelling metrics and attempt lookup once more.</p></div>`;
        return;
    }

    const grid = document.createElement("div");
    grid.className = "results-grid";

    for (let mineral of results) {
        const card = document.createElement("div");
        card.className = "mineral-card";
        
        const thumbContainer = document.createElement("div");
        thumbContainer.className = "thumb-container";
        thumbContainer.style.display = "none"; 

        const title = document.createElement("h3");
        title.textContent = mineral.Name;

        card.appendChild(thumbContainer);
        card.appendChild(title);
        grid.appendChild(card);

        card.addEventListener("click", () => {
            renderMineralProfileView(mineral);
        });

        fetchWikipediaMedia(mineral.Name).then(media => {
            if (media && media.thumbnail) {
                const img = document.createElement("img");
                img.src = media.thumbnail;
                img.alt = mineral.Name;
                thumbContainer.appendChild(img);
                thumbContainer.style.display = "block";
            }
        });
    }

    contentArea.appendChild(grid);
}

async function renderMineralProfileView(mineral) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    contentArea.innerHTML = "";

    const profileWrapper = document.createElement("div");
    profileWrapper.className = "profile-view";

    const heroImageArea = document.createElement("div");
    heroImageArea.className = "profile-hero";
    heroImageArea.style.display = "none"; 

    const bodyContainer = document.createElement("div");
    bodyContainer.className = "profile-body";

    const nameHeader = document.createElement("h2");
    nameHeader.className = "profile-title";
    nameHeader.textContent = mineral.Name;

    const dataMatrixTable = document.createElement("table");
    dataMatrixTable.className = "properties-table";

    csvColumns.forEach(propertyKey => {
        let textValue = mineral[propertyKey];
        if (textValue && textValue.toLowerCase() !== "unknown" && textValue.trim() !== "") {
            const tr = document.createElement("tr");
            tr.innerHTML = `<td class="prop-name">${propertyKey}</td><td class="prop-value">${textValue}</td>`;
            dataMatrixTable.appendChild(tr);
        }
    });

    const linkControlsArea = document.createElement("div");
    linkControlsArea.className = "external-links";

    bodyContainer.appendChild(nameHeader);
    bodyContainer.appendChild(dataMatrixTable);
    bodyContainer.appendChild(linkControlsArea);
    profileWrapper.appendChild(heroImageArea);
    profileWrapper.appendChild(bodyContainer);
    contentArea.appendChild(profileWrapper);

    const media = await fetchWikipediaMedia(mineral.Name);
    
    let wikiLinkHref = media ? media.wikiUrl : `https://en.wikipedia.org/wiki/${encodeURIComponent(mineral.Name)}`;
    const wikiBtn = document.createElement("a");
    wikiBtn.className = "ext-btn";
    wikiBtn.href = wikiLinkHref;
    wikiBtn.target = "_blank";
    wikiBtn.rel = "noopener";
    wikiBtn.textContent = "View on Wikipedia";
    linkControlsArea.appendChild(wikiBtn);

    const mindatBtn = document.createElement("a");
    mindatBtn.className = "ext-btn";
    mindatBtn.href = `https://www.mindat.org/search.php?search=${encodeURIComponent(mineral.Name)}`;
    mindatBtn.target = "_blank";
    mindatBtn.rel = "noopener";
    mindatBtn.textContent = "Search on Mindat";
    linkControlsArea.appendChild(mindatBtn);

    if (media && media.thumbnail) {
        const heroImg = document.createElement("img");
        heroImg.src = media.thumbnail;
        heroImg.alt = mineral.Name;
        heroImageArea.appendChild(heroImg);
        heroImageArea.style.display = "block";
    }
}

function locateClosestOrthography(targetInput) {
    let lowestDistanceScore = Infinity;
    let closestMatchedRecord = null;

    for (let idx = 0; idx < mineralDataset.length; idx++) {
        let currentItem = mineralDataset[idx];
        let distanceScore = computeLevenshteinDistance(targetInput.toLowerCase(), currentItem.Name.toLowerCase());
        
        if (distanceScore < lowestDistanceScore) {
            lowestDistanceScore = distanceScore;
            closestMatchedRecord = currentItem;
        }
    }

    if (lowestDistanceScore <= 4) {
        return closestMatchedRecord;
    }
    return null;
}

function computeLevenshteinDistance(strA, strB) {
    const trackingMatrix = Array(strB.length + 1).fill(null).map(() => Array(strA.length + 1).fill(null));

    for (let i = 0; i <= strA.length; i += 1) trackingMatrix[0][i] = i;
    for (let j = 0; j <= strB.length; j += 1) trackingMatrix[j][0] = j;

    for (let j = 1; j <= strB.length; j += 1) {
        for (let i = 1; i <= strA.length; i += 1) {
            const substitutionCost = strA[i - 1] === strB[j - 1] ? 0 : 1;
            trackingMatrix[j][i] = Math.min(
                trackingMatrix[j][i - 1] + 1, 
                trackingMatrix[j - 1][i] + 1, 
                trackingMatrix[j - 1][i - 1] + substitutionCost
            );
        }
    }
    return trackingMatrix[strB.length][strA.length];
}
