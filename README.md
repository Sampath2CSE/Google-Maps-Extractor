# Google Maps Extractor

Extract data from thousands of Google Maps locations and businesses. Get Google Maps data including reviews, reviewer details, images, contact info, opening hours, location, prices & more. Export scraped data, run the scraper via API, schedule and monitor runs, or integrate with other tools.

## 💰 Pricing

Our base charge for Google Maps is just **$4 per 1,000 places**. Additional features marked with ($) incur incremental costs.

## 🚀 Quick Start

To extract place data from Google Places, simply:

1. **🔍 Enter Search term** - What you're looking for (restaurant, hotel, dentist, etc.)
2. **📍 Add Location** - City, state, country, or specific address  
3. **💯 Set Number of places** - How many places to extract (1-10,000)

## 📋 Input Parameters

### Basic Search Settings
- **🔍 Search term** - What to search for (e.g., 'restaurant', 'hotel', 'dentist')
- **📍 Location** - City, state, country or specific address
- **💯 Number of places** - Maximum places to extract (1-10,000)

### Search Filters & Categories ($)
- **⭐ Minimum rating** - Only extract places with this rating or higher (0-5 stars)
- **🏷️ Category filter ($)** - Filter by specific business categories  
- **🔓 Only open businesses** - Extract only currently open businesses
- **🏪 Exclude chain businesses** - Exclude large chains (McDonald's, Starbucks, etc.)

### Additional Data ($)
- **💬 Include reviews ($)** - Extract customer reviews and ratings
- **🖼️ Include images ($)** - Extract business photos and images
- **💰 Include pricing info ($)** - Extract price level and cost information
- **🕒 Include opening hours ($)** - Extract business hours and schedule

### Advanced Settings
- **🔍 Zoom level** - Higher zoom = more places but exponentially longer runtime (10-21)
- **🚀 Max places per search** - Maximum places to crawl per search term (10-1,000)

## 📊 Output Data

Each extracted place includes:

### Basic Information
- Business name
- Star rating (0-5)
- Number of reviews
- Full address
- Phone number
- Website URL
- Business category
- Coordinates (latitude/longitude)

### Premium Data ($ options)
- **Customer reviews** - Author, rating, text, date, helpful votes
- **Business images** - Photos of location, food, interior
- **Pricing information** - Price level indicators
- **Opening hours** - Weekly schedule and special hours
- **Additional details** - Amenities, features, attributes

## 🛠️ Technical Features

### Intelligent Geolocation
- Converts location names to precise coordinates
- Creates optimized map polygons for comprehensive coverage
- Visual map verification via OpenStreetMap integration

### Advanced Crawling
- **Map segmentation** - Divides areas into grids for maximum coverage
- **Duplicate detection** - Prevents extracting the same place multiple times  
- **Smart scrolling** - Automatically loads more results when available
- **Concurrent processing** - Multiple simultaneous requests for faster extraction

### Real-time Monitoring
- Detailed progress logging and statistics
- Error tracking and retry mechanisms
- Performance metrics and timing data
- Map visualization of results

## 📈 Usage Examples

### Basic Restaurant Search
```json
{
  "searchTerm": "restaurant",
  "location": "New York, USA", 
  "maxResults": 100
}
```

### Premium Extraction with Reviews
```json
{
  "searchTerm": "coffee shop",
  "location": "San Francisco, CA",
  "maxResults": 50,
  "includeReviews": true,
  "includeImages": true,
  "minStars": 4.0
}
```

### Filtered Business Search
```json
{
  "searchTerm": "dentist",
  "location": "Chicago, IL",
  "maxResults": 200,
  "categoryFilter": ["Dental Clinic", "Orthodontist"],
  "onlyOpen": true,
  "includeOpeningHours": true
}
```

## 🗺️ Alternative Input Methods

### 📡 Geolocation Parameters
Instead of location names, you can use precise coordinates:
```json
{
  "coordinates": {
    "lat": 40.7128,
    "lng": -74.0060
  },
  "radius": 5000
}
```

### 🛰 Polygons
Define custom search areas using polygon coordinates:
```json
{
  "polygon": [
    [40.7128, -74.0060],
    [40.7589, -73.9851],
    [40.7505, -73.9934]
  ]
}
```

### 🔗 URLs
Extract data from specific Google Maps URLs:
```json
{
  "urls": [
    "https://www.google.com/maps/search/restaurant/@40.7128,-74.0060,15z"
  ]
}
```

## 📋 Output Format

### JSON Structure
```json
{
  "name": "Sample Restaurant",
  "rating": 4.5,
  "reviewCount": 324,
  "address": "123 Main St, New York, NY 10001",
  "phone": "+1-555-123-4567",
  "website": "https://example-restaurant.com",
  "category": "Italian Restaurant",
  "coordinates": {
    "lat": 40.7128,
    "lng": -74.0060
  },
  "priceLevel": 2,
  "isOpen": true,
  "openingHours": {
    "monday": "9:00 AM - 10:00 PM",
    "tuesday": "9:00 AM - 10:00 PM"
  },
  "reviews": [
    {
      "author": "John D.",
      "rating": 5,
      "text": "Amazing food and great service!",
      "date": "2024-12-15",
      "helpful": 12
    }
  ],
  "images": [
    "https://maps.googleapis.com/example-image-1.jpg"
  ],
  "extractedAt": "2025-05-30T20:00:20.697Z"
}
```

## ⚡ Performance & Optimization

### Zoom Level Guidelines
- **Zoom 10-12**: Fast extraction, major businesses only
- **Zoom 13-15**: Balanced speed and coverage (recommended)
- **Zoom 16-18**: Detailed extraction, includes smaller businesses
- **Zoom 19-21**: Maximum detail, very slow but comprehensive

### Best Practices
1. **Start with lower zoom** for initial testing
2. **Use filters** to reduce irrelevant results
3. **Set reasonable limits** to avoid timeouts
4. **Monitor costs** when using premium features ($)

## 🔧 Integration Options

### API Usage
```bash
curl -X POST https://api.apify.com/v2/acts/your-actor-id/runs \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "searchTerm": "restaurant",
    "location": "New York, USA",
    "maxResults": 100
  }'
```

### Webhook Integration
Configure webhooks to receive data when extraction completes:
```json
{
  "webhookUrl": "https://your-app.com/webhook",
  "webhookHeaders": {
    "Authorization": "Bearer your-token"
  }
}
```

### Scheduled Runs
Set up automatic daily/weekly extractions:
```json
{
  "schedule": "0 9 * * 1",
  "input": {
    "searchTerm": "new restaurants",
    "location": "San Francisco, CA"
  }
}
```

## 🚨 Rate Limits & Guidelines

### Google Maps Compliance
- Respects Google's robots.txt and terms of service
- Implements intelligent delays between requests
- Uses distributed crawling to avoid rate limits
- Rotates user agents and IP addresses

### Fair Usage
- Maximum 10,000 places per run
- Recommended: 1,000 places or fewer for optimal performance
- Premium features ($) count toward usage limits
- Bulk extractions should be split into smaller runs

## 🐛 Troubleshooting

### Common Issues

**"Location not found"**
- Check spelling of location name
- Try more specific address
- Use coordinates instead of location name

**"No results found"**
- Try broader search terms
- Increase zoom level
- Check if location has businesses of that type

**"Extraction timeout"**
- Reduce maxResults
- Lower zoom level
- Disable premium features temporarily

**"Rate limit exceeded"**
- Wait before retrying
- Reduce concurrency
- Split large extractions into smaller batches

### Debug Mode
Enable detailed logging:
```json
{
  "debugMode": true,
  "logLevel": "DEBUG"
}
```

## 📞 Support

### Documentation
- [Apify Actor Documentation](https://docs.apify.com/actors)
- [Google Maps API Guidelines](https://developers.google.com/maps/documentation)
- [Web Scraping Best Practices](https://docs.apify.com/web-scraping)

### Contact
- **Issues**: Create GitHub issue
- **Feature requests**: Contact support
- **Technical support**: support@apify.com

## 📄 License

This project is licensed under the Apache License 2.0 - see the LICENSE file for details.

## 🔄 Changelog

### Version 1.0.0
- Initial release
- Basic place extraction
- Review and image support
- Advanced filtering options
- Geolocation and polygon support
- Real-time statistics and monitoring

---

**Ready to extract Google Maps data?** 🚀

1. Click "Start" to begin extraction
2. Enter your search parameters
3. Monitor progress in real-time
4. Download results in JSON, CSV, or Excel format