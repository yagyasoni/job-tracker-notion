// public/background.js - This script runs persistently in the background

// Listen for messages from the popup script (or other parts of the extension)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Action to scrape job posting details from the current tab
    if (request.action === 'scrapeJobDetails') {
        const { jobUrl } = request;

        async function scrapeFlow() {
            let scrapedData = { companyName: '', jobTitle: '', location: '', description: '' };

            try {
                console.log(`Initiating scraping process for URL: ${jobUrl}`);

                // Step 1: Get the current active tab
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

                if (!tab || !tab.id) {
                    throw new Error("Could not get active tab information.");
                }

                // Execute the content script logic directly within the active tab
                console.log("Executing inline content script to get page content...");
                const contentScriptResponse = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    function: () => {
                        // This entire function runs in the context of the web page.
                        // It contains the logic previously in extractPageText().
                        let content = '';

                        const selectors = [
                            '.app-title', '.job-title', 'h1', 'h2', '.company-name', '.location',
                            '.job-description', '#job-description', 'div[class*="description"]',
                            'div[itemprop="description"]', 'article', 'main', '.section-content',
                            '.app-body', '.posting-page', '.gh-content', '.lever-auto-content' // Added more common selectors
                        ];

                        for (const selector of selectors) {
                            const element = document.querySelector(selector);
                            if (element) {
                                const extractedText = element.innerText.replace(/\s+/g, ' ').trim();
                                console.log(`Attempted selector "${selector}". Length: ${extractedText.length}. Found text: ${extractedText.substring(0, 100)}...`);

                                if (extractedText.length > content.length) {
                                    content = extractedText;
                                }
                                // Break early if we found a very likely job description element with decent content
                                if (['.job-description', '#job-description', 'div[itemprop="description"]', 'article', 'main', '.gh-content', '.lever-auto-content'].includes(selector) && extractedText.length > 200) {
                                    console.log(`Breaking early: Found good content in "${selector}"`);
                                    break;
                                }
                            }
                        }

                        if (content.length < 100) {
                            console.warn("Accumulated content too short or nothing specific found. Falling back to body text.");
                            const bodyText = document.body.innerText.replace(/\s+/g, ' ').trim();
                            if (bodyText.length > content.length) {
                                content = bodyText;
                            }
                        }
                        
                        content = content.replace(/\s+/g, ' ').trim();

                        const maxContentLength = 4000;
                        if (content.length > maxContentLength) {
                            content = content.substring(0, maxContentLength) + '... [Content truncated]';
                            console.warn("Page content truncated due to exceeding maxContentLength.");
                        }

                        console.log("Final extracted page content length:", content.length);
                        console.log("Final extracted page content (first 500 chars):", content.substring(0, 500));
                        return content;
                    },
                });

                let pageContent = "";
                if (contentScriptResponse && contentScriptResponse[0] && typeof contentScriptResponse[0].result === 'string') {
                    pageContent = contentScriptResponse[0].result;
                    console.log("Page content extracted by inline script. Length:", pageContent.length);
                    if (pageContent.length === 0) { // Check for truly empty content
                         throw new Error("Extracted page content is empty. This might indicate issues with the job page's content or loading.");
                    }
                } else {
                    console.error("Failed to get page content from inline script. Response:", contentScriptResponse);
                    throw new Error("Failed to extract page content from the active tab. Content script might not have run or returned correctly.");
                }

                // Step 2: Pass the extracted page content to Gemini AI for structured data extraction
                console.log(`Sending extracted page content to Gemini AI for details...`);
                scrapedData = await extractJobDetailsWithGemini(pageContent); // Pass content, not URL

                sendResponse({ success: true, message: 'Job details scraped successfully!', data: scrapedData });

            } catch (error) {
                console.error('Error in background script scraping flow:', error);
                // Send error response back to popup
                sendResponse({
                    success: false,
                    message: error.message || 'An unknown error occurred during scraping.',
                    data: { companyName: 'N/A (AI Failed)', jobTitle: 'N/A (AI Failed)', location: 'N/A (AI Failed)', description: 'N/A (AI Failed)' }
                });
            }
        }

        scrapeFlow();
        return true; // Indicate that sendResponse will be called asynchronously
    }

    // Action to add the provided job details to Notion
    if (request.action === 'addJobToNotion') {
        const { notionApiKey, notionDatabaseId, jobUrl, companyName, jobTitle, location, description, status } = request;

        async function addToNotionFlow() {
            try {
                console.log("Sending extracted data to Notion...");
                const notionResult = await addJobPostingToNotion(
                    notionApiKey,
                    notionDatabaseId,
                    jobUrl,
                    companyName,
                    jobTitle,
                    location,
                    description,
                    status // Pass the new status
                );
                console.log("Notion API call successful:", notionResult);

                sendResponse({ success: true, message: 'Job posting successfully added to Notion!', notionResult });

            } catch (error) {
                console.error('Error in background script adding to Notion flow:', error);
                sendResponse({
                    success: false,
                    message: error.message || 'An unknown error occurred when adding to Notion.',
                });
            }
        }

        addToNotionFlow();
        return true; // Indicate that sendResponse will be called asynchronously
    }
});

/**
 * Extracts job details from provided page content using the Gemini API.
 * This function prompts the LLM to analyze the provided text content and extract
 * structured information.
 * It includes a post-processing fallback for job title and location.
 *
 * @param {string} pageContent - The full text content of the job posting page.
 * @returns {Promise<Object>} An object containing companyName, jobTitle, location, and description.
 */
async function extractJobDetailsWithGemini(pageContent) {
    // Gemini API configuration
    const GEMINI_API_MODEL = "gemini-2.0-flash";
    const apiKey = "AIzaSyC4iNVUCAEynr2kGD9GjyBkXBV1G3E1yOE"; // Your Gemini API key
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_API_MODEL}:generateContent?key=${apiKey}`;

    if (apiKey === "YOUR_GEMINI_API_KEY_HERE" || apiKey === "") {
        console.warn("Gemini API Key is not configured for local extension use. Expect 403 errors if running locally.");
    }

    const prompt = `
        Analyze the following job posting text and extract the:
        1. Company Name
        2. Job Title
        3. Job Location (e.g., city, state, country, or "Remote")
        4. A brief, concise description of the job (max 200 words).
        
        If any information is not explicitly found, indicate "N/A".
        
        Job Posting Text:
        ---
        ${pageContent}
        ---
        
        Please provide the output as a JSON object with the following keys: "companyName", "jobTitle", "location", "description".
        Example JSON output: {"companyName": "Google", "jobTitle": "Software Engineer", "location": "Mountain View, CA", "description": "Develop and maintain software."}
    `;

    const chatHistory = [{ role: "user", parts: [{ text: prompt }] }];

    const payload = {
        contents: chatHistory,
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "OBJECT",
                properties: {
                    companyName: { type: "STRING" },
                    jobTitle: { type: "STRING" },
                    location: { type: "STRING" },
                    description: { type: "STRING" }
                },
                propertyOrdering: ["companyName", "jobTitle", "location", "description"]
            }
        }
    };

    try {
        console.log("Calling Gemini API with payload (truncated content for log):", JSON.stringify({ ...payload, contents: [{ ...payload.contents[0], parts: [{ text: payload.contents[0].parts[0].text.substring(0, 200) + '...' }] }] }, null, 2));
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Gemini API call failed:', errorData);
            throw new Error(`Gemini API request failed with status ${response.status}: ${errorData.error.message || 'Unknown error'}`);
        }

        const result = await response.json();
        console.log("Raw Gemini API response:", result);

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
            const jsonText = result.candidates[0].content.parts[0].text;
            console.log("Gemini raw JSON text:", jsonText);
            let parsedData;
            try {
                parsedData = JSON.parse(jsonText);
            } catch (jsonError) {
                console.error("Failed to parse JSON from Gemini response:", jsonError);
                // Fallback to simpler extraction if JSON is malformed
                return {
                    companyName: 'N/A (JSON Parse Error)',
                    jobTitle: 'N/A (JSON Parse Error)',
                    location: 'N/A (JSON Parse Error)',
                    description: 'N/A (JSON Parse Error)'
                };
            }


            let jobTitle = parsedData.jobTitle || 'N/A (AI Empty)';
            let location = parsedData.location || 'N/A (AI Empty)';
            let companyName = parsedData.companyName || 'N/A (AI Empty)';
            let description = parsedData.description || 'N/A (AI Empty)';

            // --- Post-processing / Fallback logic for Job Title and Location ---
            // If AI couldn't find a job title or it's "N/A", try to infer from common patterns
            if (jobTitle.includes('N/A') || jobTitle.trim() === '') {
                // Try to extract from first H1 or title tag if available in content (simple text search)
                const h1Match = pageContent.match(/<h1[^>]*>(.*?)<\/h1>/i);
                if (h1Match && h1Match[1] && h1Match[1].trim().length > 5) {
                    jobTitle = h1Match[1].trim();
                } else {
                    // Try to infer from the overall page title if it exists within the content
                    const titleMatch = pageContent.match(/<title[^>]*>(.*?)<\/title>/i);
                    if (titleMatch && titleMatch[1] && titleMatch[1].trim().length > 5) {
                        // Simple heuristic for title like "Job Title at Company | Board"
                        const titleParts = titleMatch[1].split(/ at | \| | - /).map(s => s.trim());
                        if (titleParts.length > 0) jobTitle = titleParts[0];
                    }
                }
                // Further refine job title if it contains common company/location terms
                if (jobTitle.length > 0 && (jobTitle.toLowerCase().includes('inc') || jobTitle.toLowerCase().includes('llc') || jobTitle.toLowerCase().includes('corp') || jobTitle.toLowerCase().includes('remote'))) {
                     const cleanTitle = jobTitle.replace(/ at .*| \| .*| - .*/i, '').trim();
                     if (cleanTitle.length > 0 && cleanTitle !== jobTitle) jobTitle = cleanTitle;
                }
                if (jobTitle.length > 150) jobTitle = jobTitle.substring(0, 150) + '...'; // Truncate if too long
            }

            // If AI couldn't find a location or it's "N/A", try to infer from common patterns
            if (location.includes('N/A') || location.trim() === '') {
                // Look for common location keywords
                const commonLocationsRegex = /(remote|hybrid|on-site|onsite|london|new york|nyc|san francisco|sf|california|ca|texas|tx|singapore|dublin|sydney|bangalore|tokyo|berlin|paris|amsterdam|usa|uk|india|canada|germany|france)/ig;
                const cityStateZipPattern = /\b([A-Z][a-z]+(?: [A-Z][a-z]+)*), (?:[A-Z]{2}|\w+)(?: \d{5})?\b/g; // e.g., "New York, NY", "London, UK"
                const countryOnlyPattern = /\b(?:United States|United Kingdom|India|Canada|Germany|France|Singapore|Australia|Ireland)\b/g;

                const remoteMatch = pageContent.match(/remote/i);
                const hybridMatch = pageContent.match(/hybrid/i);
                const cityStateMatch = pageContent.match(cityStateZipPattern);
                const countryMatch = pageContent.match(countryOnlyPattern);
                const commonKeywordsMatch = pageContent.match(commonLocationsRegex);

                let inferredLocations = new Set();
                if (remoteMatch) inferredLocations.add('Remote');
                if (hybridMatch) inferredLocations.add('Hybrid');
                if (cityStateMatch) cityStateMatch.forEach(m => inferredLocations.add(m.trim()));
                if (countryMatch) countryMatch.forEach(m => inferredLocations.add(m.trim()));
                if (commonKeywordsMatch) commonKeywordsMatch.forEach(m => inferredLocations.add(m.trim()));

                if (inferredLocations.size > 0) {
                    location = Array.from(inferredLocations).join(', ');
                }
                if (location.length > 100) location = location.substring(0, 100) + '...'; // Truncate if too long
            }

            // Ensure companyName and description also have fallbacks for completely empty strings
            companyName = companyName || 'N/A (AI Empty)';
            description = description || 'No description extracted.';


            return {
                companyName: companyName,
                jobTitle: jobTitle,
                location: location,
                description: description
            };
        } else {
            console.error("Gemini API response structure unexpected or empty content:", result);
            throw new Error("Gemini API returned unexpected or empty content.");
        }

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error(`AI extraction failed: ${error.message}`);
    }
}


/**
 * Adds a new page (job posting) to the specified Notion database.
 * @param {string} apiKey - Your Notion API Key (Integration Token).
 * @param {string} databaseId - The ID of the Notion database.
 * @param {string} url - The URL of the job posting.
 * @param {string} companyName - The name of the company.
 * @param {string} jobTitle - The title of the job.
 * @param {string} location - The job location.
 * @param {string} description - A short description of the job.
 * @param {string} status - The status of the job application (e.g., "Applied", "Wishlist").
 * @returns {Promise<Object>} The response from the Notion API.
 */
async function addJobPostingToNotion(apiKey, databaseId, url, companyName, jobTitle, location, description, status) {
    const notionApiUrl = 'https://api.notion.com/v1/pages';

    // IMPORTANT: Ensure the 'Status' property in your Notion database is of type 'Select'.
    // The 'name' field in 'select' must exactly match one of the options defined in your Notion database.
    // E.g., if you have 'Applied', 'Wishlist', 'Rejected' in Notion, make sure the status sent here is one of those.
    const payload = {
        parent: {
            database_id: databaseId,
        },
        properties: {
            'Job Title': {
                title: [
                    {
                        text: {
                            content: jobTitle || 'Untitled Job',
                        },
                    },
                ],
            },
            'Company': {
                rich_text: [
                    {
                        text: {
                            content: companyName || 'N/A',
                        },
                    },
                ],
            },
            'URL': {
                url: url,
            },
            'Location': {
                rich_text: [
                    {
                        text: {
                            content: location || 'N/A',
                        },
                    },
                ],
            },
            'Description': {
                rich_text: [
                    {
                        text: {
                            content: description || 'No description extracted.',
                        },
                    },
                ],
            },
            // New 'Status' property
            'Status': {
                select: {
                    name: status || 'N/A', // Default to 'N/A' if not provided
                },
            },
        },
    };

    console.log("Sending payload to Notion:", JSON.stringify(payload, null, 2));
    const response = await fetch(notionApiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Notion-Version': '2022-06-28',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    console.log("Notion API response:", data);

    if (!response.ok) {
        console.error('Notion API Error Details:', data);
        const errorMessage = data.message || `Notion API returned an error: ${response.status}`;
        throw new Error(`Failed to add to Notion: ${errorMessage}`);
    }

    return data;
}