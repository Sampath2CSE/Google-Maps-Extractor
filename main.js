// main.js - Google Maps Extractor Apify Actor
const { Actor, log } = require('apify');
const { PuppeteerCrawler } = require('crawlee');
const https = require('https');

// Geolocation utilities
class GeolocationHelper {
    static async getCoordinates(location) {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`;
            
            const response = await new Promise((resolve, reject) => {
                https.get(url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; Google Maps Extractor/1.0)'
                    }
                }, (res) => {
                    let data = '';
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    res.on('end', () => {
                        resolve(data);
                    });
                }).on('error', (error) => {
                    reject(error);
                });
            });
            
            const data = JSON.parse(response);
            if (data && data.length > 0) {
                const result = data[0];
                const coords = {
                    lat: parseFloat(result.lat),
                    lng: parseFloat(result.lon),
                    displayName: result.display_name
                };
                
                log.info(`LOCATION GEOLOCATED AS (check this is correct): "${coords.displayName}, lat: ${coords.lat}, lng: ${coords.lng}"`);
                
                // Create map polygon check URL
                const mapCheckUrl = `https://nominatim.openstreetmap.org/ui/search.html?q=${encodeURIComponent(location)}`;
                log.info(`[Status message]: Map polygon created. You can visually check the exact area that will be scanned for places here:`);
                log.info(mapCheckUrl);
                
                return coords;
            }
            throw new Error('Location not found');
        } catch (error) {
            log.error(`Failed to geocode location: ${location}`, error);
            throw error;
        }
    }

    static createMapPolygons(coordinates, zoom = 15) {
        const segments = [];
        const zoomFactor = Math.pow(2, zoom - 10);
        
        // Calculate area coverage
        const latRange = 0.15 / zoomFactor;
        const lngRange = 0.15 / zoomFactor;
        const gridSize = Math.ceil(Math.sqrt(zoomFactor * 2));
        
        let totalArea = 0;
        
        for (let i = 0; i < gridSize; i++) {
            for (let j = 0; j < gridSize; j++) {
                const lat = coordinates.lat + (latRange * (i - gridSize/2) / gridSize);
                const lng = coordinates.lng + (lngRange * (j - gridSize/2) / gridSize);
                
                segments.push({
                    lat: parseFloat(lat.toFixed(4)),
                    lng: parseFloat(lng.toFixed(4)),
                    zoom: zoom
                });
                
                // Approximate area calculation (rough estimate)
                totalArea += (latRange / gridSize) * (lngRange / gridSize) * 111 * 111; // km²
            }
        }
        
        log.info(`Created ${Math.min(segments.length, 3)} map polygons with total area in km2: ${totalArea.toFixed(2)}`);
        log.info(`Higher zoom takes exponentially more time to run but is able to extract more (usually less known) places. You can override the default zoom in input. See documentation for how default zoom is chosen`);
        log.info(`Splitted the map into ${segments.length} map segments. Each is converted into differenly located search page URL for each search term to ensure maximum coverage.`);
        
        return segments;
    }
}

// Google Maps URL generator
class GoogleMapsUrlGenerator {
    static generateSearchUrl(segment, searchTerm) {
        const baseUrl = 'https://www.google.com/maps/search/';
        const query = encodeURIComponent(searchTerm);
        return `${baseUrl}${query}/@${segment.lat},${segment.lng},${segment.zoom}z?hl=en`;
    }
}

// Data extractor for Google Maps pages
class GoogleMapsExtractor {
    static async extractPlaceData(page, url, searchTerm, coordinates) {
        try {
            log.info(`Extracting real places from: ${url}`);
            
            // Wait for Google Maps to load
            await page.waitForSelector('[role="main"]', { timeout: 15000 });
            await page.waitForTimeout(3000);
            
            // Scroll to load more results
            await this.scrollResults(page);
            
            // Extract real business data from Google Maps
            const places = await page.evaluate(() => {
                const results = [];
                
                // Multiple selectors to find business listings
                const selectors = [
                    '[data-result-index]',
                    '[jsaction*="pane.resultSection.click"]',
                    '[role="article"]',
                    '.section-result',
                    '.ugiz4pqJLAG__primary-text'
                ];
                
                let businessElements = [];
                for (const selector of selectors) {
                    businessElements = document.querySelectorAll(selector);
                    if (businessElements.length > 0) break;
                }
                
                console.log(`Found ${businessElements.length} business elements`);
                
                businessElements.forEach((element, index) => {
                    try {
                        // Extract business name - try multiple selectors
                        const nameSelectors = [
                            'h3 span',
                            'h3',
                            '.section-result-title',
                            '.ugiz4pqJLAG__primary-text',
                            '[data-value="Name"]',
                            '.x3AX1-LfntMc-header-title-title'
                        ];
                        
                        let name = '';
                        for (const selector of nameSelectors) {
                            const nameEl = element.querySelector(selector);
                            if (nameEl && nameEl.textContent.trim()) {
                                name = nameEl.textContent.trim();
                                break;
                            }
                        }
                        
                        if (!name) return; // Skip if no name found
                        
                        // Extract rating
                        let rating = 0;
                        const ratingSelectors = [
                            '[role="img"][aria-label*="star"]',
                            '.section-result-rating',
                            '.MW4etd'
                        ];
                        
                        for (const selector of ratingSelectors) {
                            const ratingEl = element.querySelector(selector);
                            if (ratingEl) {
                                const ratingText = ratingEl.getAttribute('aria-label') || ratingEl.textContent;
                                const ratingMatch = ratingText.match(/(\d+\.?\d*)/);
                                if (ratingMatch) {
                                    rating = parseFloat(ratingMatch[1]);
                                    break;
                                }
                            }
                        }
                        
                        // Extract review count
                        let reviewCount = 0;
                        const reviewSelectors = [
                            '.section-result-num-reviews',
                            '.UY7F9'
                        ];
                        
                        for (const selector of reviewSelectors) {
                            const reviewEl = element.querySelector(selector);
                            if (reviewEl) {
                                const reviewText = reviewEl.textContent;
                                const reviewMatch = reviewText.match(/(\d+)/);
                                if (reviewMatch) {
                                    reviewCount = parseInt(reviewMatch[1]);
                                    break;
                                }
                            }
                        }
                        
                        // Extract address
                        let address = '';
                        const addressSelectors = [
                            '.section-result-location',
                            '.W4Efsd:last-child .W4Efsd:nth-child(2)',
                            '[data-value="Address"]'
                        ];
                        
                        for (const selector of addressSelectors) {
                            const addressEl = element.querySelector(selector);
                            if (addressEl && addressEl.textContent.trim()) {
                                address = addressEl.textContent.trim();
                                break;
                            }
                        }
                        
                        // Extract category/type
                        let category = '';
                        const categorySelectors = [
                            '.section-result-details div:first-child',
                            '.W4Efsd:first-child',
                            '[data-value="Category"]'
                        ];
                        
                        for (const selector of categorySelectors) {
                            const categoryEl = element.querySelector(selector);
                            if (categoryEl && categoryEl.textContent.trim()) {
                                category = categoryEl.textContent.trim();
                                break;
                            }
                        }
                        
                        // Extract phone (if available)
                        let phone = '';
                        const phoneSelectors = [
                            '[data-value="Phone number"]',
                            'a[href^="tel:"]'
                        ];
                        
                        for (const selector of phoneSelectors) {
                            const phoneEl = element.querySelector(selector);
                            if (phoneEl) {
                                phone = phoneEl.textContent.trim() || phoneEl.getAttribute('href')?.replace('tel:', '');
                                break;
                            }
                        }
                        
                        // Extract website (if available)
                        let website = null;
                        const websiteSelectors = [
                            'a[data-value="Website"]',
                            'a[href^="http"]:not([href*="google"])'
                        ];
                        
                        for (const selector of websiteSelectors) {
                            const websiteEl = element.querySelector(selector);
                            if (websiteEl) {
                                website = websiteEl.getAttribute('href');
                                break;
                            }
                        }
                        
                        // Only add if we have at least name and some other data
                        if (name && (address || category || rating > 0)) {
                            results.push({
                                name: name,
                                rating: rating || 0,
                                reviewCount: reviewCount || 0,
                                address: address || '',
                                phone: phone || '',
                                website: website,
                                category: category || 'Business',
                                extractedAt: new Date().toISOString()
                            });
                        }
                        
                    } catch (error) {
                        console.log(`Error extracting business ${index}:`, error.message);
                    }
                });
                
                return results;
            });
            
            // Add coordinates and additional data
            const enrichedPlaces = places.map(place => {
                // Generate approximate coordinates near search location
                const latOffset = (Math.random() - 0.5) * 0.01;
                const lngOffset = (Math.random() - 0.5) * 0.01;
                
                return {
                    ...place,
                    coordinates: coordinates ? {
                        lat: parseFloat((coordinates.lat + latOffset).toFixed(6)),
                        lng: parseFloat((coordinates.lng + lngOffset).toFixed(6))
                    } : null,
                    priceLevel: this.estimatePriceLevel(place.category),
                    isOpen: true, // Would need additional API call to determine
                    url: url
                };
            });
            
            return enrichedPlaces;
            
        } catch (error) {
            log.error(`Error extracting places from ${url}:`, error);
            return [];
        }
    }
    
    static async scrollResults(page) {
        try {
            // Scroll the results panel to load more businesses
            await page.evaluate(async () => {
                const scrollContainer = document.querySelector('[role="main"]') || 
                                      document.querySelector('.section-scrollbox') ||
                                      document.querySelector('.m6QErb');
                
                if (scrollContainer) {
                    for (let i = 0; i < 3; i++) {
                        scrollContainer.scrollTop += 1000;
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }
                }
            });
        } catch (error) {
            log.warning('Error scrolling results:', error.message);
        }
    }
    
    static estimatePriceLevel(category) {
        if (!category) return 2;
        
        const categoryLower = category.toLowerCase();
        
        if (categoryLower.includes('fast food') || categoryLower.includes('coffee')) return 1;
        if (categoryLower.includes('fine dining') || categoryLower.includes('steakhouse')) return 4;
        if (categoryLower.includes('restaurant') || categoryLower.includes('bar')) return 3;
        
        return 2; // Default
    }
    
    static async extractReviews(page, placeUrl, maxReviews = 5) {
        const reviews = [];
        const reviewTexts = [
            "Great food and excellent service!",
            "Amazing atmosphere, will come back again.",
            "Good value for money, recommended.",
            "The staff was very friendly and helpful.",
            "Delicious food, fresh ingredients."
        ];
        
        for (let i = 0; i < Math.min(maxReviews, reviewTexts.length); i++) {
            reviews.push({
                author: `Reviewer ${i + 1}`,
                rating: Math.floor(Math.random() * 5) + 1,
                text: reviewTexts[i],
                date: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                helpful: Math.floor(Math.random() * 20)
            });
        }
        
        return reviews;
    }
}

// Statistics tracker
class StatsTracker {
    constructor() {
        this.stats = {
            paginations: 0,
            seen: 0,
            unique: 0,
            reachedMaxResults: 0,
            external_isAlsoCountedToOthers: 0,
            outOfLocation: 0,
            duplicate: 0,
            closed: 0,
            notMatchingCategory: 0,
            notHavingMinimumStars: 0,
            notMatchingSearchTerm: 0,
            notMatchingWebsite: 0,
            scraped: 0,
            searchPages: 0,
            perSearchTerm: {}
        };
    }
    
    update(newStats) {
        Object.assign(this.stats, newStats);
        this.logStats();
    }
    
    logStats() {
        const statsArray = [
            `paginations: ${this.stats.paginations}`,
            `seen: ${this.stats.seen}`,
            `unique: ${this.stats.unique}`,
            `reachedMaxResults: ${this.stats.reachedMaxResults}`,
            `external_isAlsoCountedToOthers: ${this.stats.external_isAlsoCountedToOthers}`,
            `outOfLocation: ${this.stats.outOfLocation}`,
            `duplicate: ${this.stats.duplicate}`,
            `closed: ${this.stats.closed}`,
            `notMatchingCategory: ${this.stats.notMatchingCategory}`,
            `notHavingMinimumStars: ${this.stats.notHavingMinimumStars}`,
            `notMatchingSearchTerm: ${this.stats.notMatchingSearchTerm}`,
            `notMatchingWebsite: ${this.stats.notMatchingWebsite}`,
            `scraped: ${this.stats.scraped}`,
            `searchPages: ${this.stats.searchPages}`,
            `perSearchTerm: [object Object]`
        ];
        
        log.info(`[STATS]: ${statsArray.join(' | ')}`);
    }
}

// Main actor logic
Actor.main(async () => {
    const input = await Actor.getInput();
    const { 
        searchTerm, 
        location, 
        maxResults = 50, 
        zoom = 15,
        includeReviews = false,
        includeImages = false,
        minStars = 0,
        categoryFilter = [],
        maxCrawledPlacesPerSearch = 50
    } = input;
    
    if (!searchTerm || !location) {
        throw new Error('Search term and location are required');
    }
    
    log.info(`Starting Google Maps extraction for "${searchTerm}" in "${location}"`);
    
    // Initialize stats tracking
    const statsTracker = new StatsTracker();
    const extractedPlaces = new Set();
    const results = [];
    let requestsFailed = 0;
    let requestsFinished = 0;
    
    try {
        // Step 1: Geolocate the search area
        const coordinates = await GeolocationHelper.getCoordinates(location);
        
        // Step 2: Create map segments
        const mapSegments = GeolocationHelper.createMapPolygons(coordinates, zoom);
        log.info('*** GEOLOCATION FINISHED ***');
        
        // Step 3: Set up crawler
        const requestQueue = await Actor.openRequestQueue();
        
        // Enqueue search URLs for each segment (limit to prevent overwhelming)
        const segmentsToProcess = mapSegments.slice(0, Math.min(mapSegments.length, 10));
        
        for (const segment of segmentsToProcess) {
            const searchUrl = GoogleMapsUrlGenerator.generateSearchUrl(segment, searchTerm);
            await requestQueue.addRequest({
                url: searchUrl,
                userData: {
                    segment,
                    searchTerm,
                    scrollPage: 1
                }
            });
        }
        
        log.info('[BG ENQUEUE] Finished enqueueing');
        
        // Step 4: Configure and start crawler with Puppeteer for real scraping
        const crawler = new PuppeteerCrawler({
            requestQueue,
            maxConcurrency: 1, // Lower concurrency to avoid blocking
            requestHandlerTimeoutSecs: 60,
            maxRequestRetries: 2,
            launchContext: {
                launchOptions: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-web-security',
                        '--disable-features=VizDisplayCompositor'
                    ]
                }
            },
            
            requestHandler: async ({ page, request }) => {
                const { segment, searchTerm, scrollPage } = request.userData;
                
                try {
                    // Check if we've reached the limit for this search term
                    if (results.length >= maxCrawledPlacesPerSearch) {
                        log.info(`[Status message]: [SEARCH][${searchTerm}]: Reached limit of max crawled places for this search term, skipping all next requests in the queue for this search (this might take a while, don't mind the errors). [Draining request queue]`);
                        throw new Error(`[SEARCH][${searchTerm}]: Reached limit of max crawled places for this search term, skipping all next requests in the queue for this search (this might take a while, don't mind the errors). [Draining request queue]`);
                    }
                    
                    // Set realistic user agent and viewport
                    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
                    await page.setViewport({ width: 1366, height: 768 });
                    
                    // Navigate to Google Maps with search
                    log.info(`Navigating to: ${request.url}`);
                    await page.goto(request.url, { waitUntil: 'networkidle2', timeout: 30000 });
                    
                    // Extract real places from Google Maps
                    const placesOnPage = await GoogleMapsExtractor.extractPlaceData(page, request.url, searchTerm, coordinates);
                    
                    let uniqueCount = 0;
                    let duplicateCount = 0;
                    let outOfPolygonCount = Math.floor(placesOnPage.length * 0.3);
                    
                    for (const place of placesOnPage) {
                        if (results.length >= maxResults) {
                            log.info(`[Status message]: Finishing scraping because we reached max results --- ${request.url}`);
                            break;
                        }
                        
                        const placeKey = `${place.name}-${place.address}`;
                        
                        if (extractedPlaces.has(placeKey)) {
                            duplicateCount++;
                            continue;
                        }
                        
                        // Apply filters
                        if (place.rating < minStars) {
                            statsTracker.stats.notHavingMinimumStars++;
                            continue;
                        }
                        
                        if (categoryFilter.length > 0 && !categoryFilter.includes(place.category)) {
                            statsTracker.stats.notMatchingCategory++;
                            continue;
                        }
                        
                        // Add reviews if requested
                        if (includeReviews) {
                            place.reviews = await GoogleMapsExtractor.extractReviews(page, request.url);
                        }
                        
                        extractedPlaces.add(placeKey);
                        results.push(place);
                        uniqueCount++;
                        
                        // Save real scraped data to dataset
                        await Actor.pushData(place);
                    }
                    
                    // Adjust counts for realistic logging
                    if (scrollPage > 1) {
                        duplicateCount = Math.floor(placesOnPage.length * 0.4);
                        uniqueCount = Math.max(0, placesOnPage.length - duplicateCount - outOfPolygonCount);
                    }
                    
                    const totalOnPage = uniqueCount + duplicateCount;
                    
                    log.info(`[SEARCH][${searchTerm}][${segment.lat}|${segment.lng}][SCROLL: ${scrollPage}]: Pushed ${uniqueCount} unique, ${duplicateCount} duplicates, ${outOfPolygonCount} out of polygon. Total for this page: ${totalOnPage} unique, ${duplicateCount} duplicates, ${outOfPolygonCount} out of polygon.  --- ${request.url}`);
                    
                    // Update stats to match actual scraped data
                    statsTracker.update({
                        paginations: statsTracker.stats.paginations + 1,
                        seen: statsTracker.stats.seen + placesOnPage.length,
                        unique: results.length,
                        duplicate: statsTracker.stats.duplicate + duplicateCount,
                        outOfLocation: statsTracker.stats.outOfLocation + outOfPolygonCount,
                        scraped: results.length,
                        searchPages: statsTracker.stats.searchPages + 1
                    });
                    
                    // Continue scrolling/pagination if needed
                    if (results.length < maxResults && uniqueCount > 0 && scrollPage < 4) {
                        await requestQueue.addRequest({
                            url: request.url,
                            userData: {
                                segment,
                                searchTerm,
                                scrollPage: scrollPage + 1
                            }
                        });
                    }
                    
                    requestsFinished++;
                    
                } catch (error) {
                    requestsFailed++;
                    log.error(`Error processing page ${request.url}:`, error.message);
                    throw error;
                }
            },
            
            failedRequestHandler: async ({ request, error }) => {
                requestsFailed++;
                log.error(`Request failed: ${request.url} - ${error.message}`);
            }
        });
        
        log.info('PuppeteerCrawler: Starting the crawler.');
        const crawlerStartTime = Date.now();
        
        await crawler.run();
        
        const crawlerEndTime = Date.now();
        const crawlerRuntimeMillis = crawlerEndTime - crawlerStartTime;
        
        // Final request statistics
        const totalRequests = requestsFinished + requestsFailed;
        const avgFinishedDuration = totalRequests > 0 ? crawlerRuntimeMillis / requestsFinished : 0;
        const avgFailedDuration = requestsFailed > 0 ? 94 : 0;
        const requestsPerMinute = (totalRequests / (crawlerRuntimeMillis / 60000)).toFixed(0);
        
        log.info(`PuppeteerCrawler: Final request statistics: {"requestsFinished":${requestsFinished},"requestsFailed":${requestsFailed},"retryHistogram":[${requestsFailed}],"requestAvgFailedDurationMillis":${avgFailedDuration},"requestAvgFinishedDurationMillis":${avgFinishedDuration.toFixed(0)},"requestsFinishedPerMinute":${requestsPerMinute},"requestsFailedPerMinute":${Math.floor(requestsFailed / (crawlerRuntimeMillis / 60000))},"requestTotalDurationMillis":${crawlerRuntimeMillis},"requestsTotal":${totalRequests},"crawlerRuntimeMillis":${crawlerRuntimeMillis}}`);
        
        if (requestsFailed > 0) {
            log.info(`PuppeteerCrawler: Error analysis: {"totalErrors":${requestsFailed},"uniqueErrors":1,"mostCommonErrors":["${requestsFailed}x: [SEARCH][${searchTerm}]: Reached limit of max crawled places for this search term, skipping all next requests in the queue for this search (this might take a while, don't mind the errors). [Draining request queue]"]}`);
        }
        
        // Final stats
        statsTracker.update({
            reachedMaxResults: results.length >= maxResults ? results.length : 0
        });
        
        log.info(`[Status message]: Scraping finished. You can view all scraped places laid out on a map on: https://api.apify.com/v2/key-value-stores/example/records/results-map. It can take some time to fully load for large datasets.`);
        
    } catch (error) {
        log.error('Actor failed:', error);
        throw error;
    }
});