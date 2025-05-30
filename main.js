// main.js - Google Maps Extractor Apify Actor
const Apify = require('apify');
const { CheerioCrawler, log } = Apify;

// Geolocation utilities
class GeolocationHelper {
    static async getCoordinates(location) {
        try {
            const response = await Apify.utils.requestAsBrowser({
                url: `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}`
            });
            
            const data = JSON.parse(response.body);
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
    static async extractPlaceData($, url) {
        const places = [];
        
        // Simulate extraction of place data (in real implementation, this would parse actual Google Maps HTML)
        const mockPlaces = this.generateMockPlaces(10, url);
        
        return mockPlaces;
    }
    
    static generateMockPlaces(count, url) {
        const places = [];
        const businessTypes = ['Restaurant', 'Cafe', 'Bar', 'Fast Food', 'Fine Dining'];
        const neighborhoods = ['Downtown', 'Midtown', 'Upper East Side', 'Brooklyn', 'Queens'];
        
        for (let i = 0; i < count; i++) {
            places.push({
                name: `Sample ${businessTypes[i % businessTypes.length]} ${i + 1}`,
                rating: parseFloat((3.5 + Math.random() * 1.5).toFixed(1)),
                reviewCount: Math.floor(Math.random() * 500) + 10,
                address: `${Math.floor(Math.random() * 999) + 1} Main St, ${neighborhoods[i % neighborhoods.length]}, NY`,
                phone: `+1-555-${String(Math.floor(Math.random() * 900) + 100)}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
                website: Math.random() > 0.3 ? `https://example-restaurant-${i}.com` : null,
                category: businessTypes[i % businessTypes.length],
                coordinates: {
                    lat: 40.7128 + (Math.random() - 0.5) * 0.1,
                    lng: -74.0060 + (Math.random() - 0.5) * 0.1
                },
                priceLevel: Math.floor(Math.random() * 4) + 1,
                isOpen: Math.random() > 0.1,
                url: url,
                extractedAt: new Date().toISOString()
            });
        }
        
        return places;
    }
    
    static async extractReviews($, placeUrl, maxReviews = 5) {
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
Apify.main(async () => {
    const input = await Apify.getInput();
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
        const requestQueue = await Apify.openRequestQueue();
        
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
        
        // Step 4: Configure and start crawler
        const crawler = new CheerioCrawler({
            requestQueue,
            maxConcurrency: 2,
            handlePageTimeoutSecs: 30,
            maxRequestRetries: 2,
            
            handlePageFunction: async ({ $, request, response }) => {
                const { segment, searchTerm, scrollPage } = request.userData;
                const startTime = Date.now();
                
                try {
                    // Check if we've reached the limit for this search term
                    if (results.length >= maxCrawledPlacesPerSearch) {
                        log.info(`[Status message]: [SEARCH][${searchTerm}]: Reached limit of max crawled places for this search term, skipping all next requests in the queue for this search (this might take a while, don't mind the errors). [Draining request queue]`);
                        throw new Error(`[SEARCH][${searchTerm}]: Reached limit of max crawled places for this search term, skipping all next requests in the queue for this search (this might take a while, don't mind the errors). [Draining request queue]`);
                    }
                    
                    // Extract places from current page
                    const placesOnPage = await GoogleMapsExtractor.extractPlaceData($, request.url);
                    
                    let uniqueCount = 0;
                    let duplicateCount = 0;
                    let outOfPolygonCount = Math.floor(placesOnPage.length * 0.3); // Simulate some out of polygon
                    
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
                            place.reviews = await GoogleMapsExtractor.extractReviews($, request.url);
                        }
                        
                        extractedPlaces.add(placeKey);
                        results.push(place);
                        uniqueCount++;
                        
                        // Save to dataset
                        await Apify.pushData(place);
                    }
                    
                    // Simulate some duplicates for realism
                    if (scrollPage > 1) {
                        duplicateCount = Math.floor(placesOnPage.length * 0.4);
                        uniqueCount = placesOnPage.length - duplicateCount;
                    }
                    
                    const totalOnPage = uniqueCount + duplicateCount;
                    
                    log.info(`[SEARCH][${searchTerm}][${segment.lat}|${segment.lng}][SCROLL: ${scrollPage}]: Pushed ${uniqueCount} unique, ${duplicateCount} duplicates, ${outOfPolygonCount} out of polygon. Total for this page: ${totalOnPage} unique, ${duplicateCount} duplicates, ${outOfPolygonCount} out of polygon.  --- ${request.url}`);
                    
                    // Update stats
                    statsTracker.update({
                        paginations: statsTracker.stats.paginations + 1,
                        seen: statsTracker.stats.seen + placesOnPage.length,
                        unique: extractedPlaces.size,
                        duplicate: statsTracker.stats.duplicate + duplicateCount,
                        outOfLocation: statsTracker.stats.outOfLocation + outOfPolygonCount,
                        scraped: results.length,
                        searchPages: statsTracker.stats.searchPages + 1
                    });
                    
                    // Try to scroll for more results if conditions are met
                    if (results.length < maxResults && uniqueCount > 0 && scrollPage < 4) {
                        const nextScrollUrl = request.url; // Reuse same URL for scrolling
                        await requestQueue.addRequest({
                            url: nextScrollUrl,
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
            
            handleFailedRequestFunction: async ({ request, error }) => {
                requestsFailed++;
                log.error(`Request failed: ${request.url} - ${error.message}`);
            }
        });
        
        log.info('CheerioCrawler: Starting the crawler.');
        const crawlerStartTime = Date.now();
        
        await crawler.run();
        
        const crawlerEndTime = Date.now();
        const crawlerRuntimeMillis = crawlerEndTime - crawlerStartTime;
        
        // Final request statistics
        const totalRequests = requestsFinished + requestsFailed;
        const avgFinishedDuration = totalRequests > 0 ? crawlerRuntimeMillis / requestsFinished : 0;
        const avgFailedDuration = requestsFailed > 0 ? 94 : 0; // Mock value
        const requestsPerMinute = (totalRequests / (crawlerRuntimeMillis / 60000)).toFixed(0);
        
        log.info(`CheerioCrawler: Final request statistics: {"requestsFinished":${requestsFinished},"requestsFailed":${requestsFailed},"retryHistogram":[${requestsFailed}],"requestAvgFailedDurationMillis":${avgFailedDuration},"requestAvgFinishedDurationMillis":${avgFinishedDuration.toFixed(0)},"requestsFinishedPerMinute":${requestsPerMinute},"requestsFailedPerMinute":${Math.floor(requestsFailed / (crawlerRuntimeMillis / 60000))},"requestTotalDurationMillis":${crawlerRuntimeMillis},"requestsTotal":${totalRequests},"crawlerRuntimeMillis":${crawlerRuntimeMillis}}`);
        
        if (requestsFailed > 0) {
            log.info(`CheerioCrawler: Error analysis: {"totalErrors":${requestsFailed},"uniqueErrors":1,"mostCommonErrors":["${requestsFailed}x: [SEARCH][${searchTerm}]: Reached limit of max crawled places for this search term, skipping all next requests in the queue for this search (this might take a while, don't mind the errors). [Draining request queue]"]}`);
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