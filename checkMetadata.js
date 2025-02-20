// checkMetadata.js

const fetch = require('node-fetch');

async function checkMetadataUri() {
    const uri = "https://foxsake123.github.io/token-metadata/metadata.json";
    
    try {
        console.log("Attempting to fetch metadata from:", uri);
        const response = await fetch(uri);
        
        if (!response.ok) {
            console.log(`HTTP Error: ${response.status} ${response.statusText}`);
            return;
        }

        const contentType = response.headers.get('content-type');
        console.log("Content-Type:", contentType);
        
        const text = await response.text();
        console.log("\nRaw response:");
        console.log(text);
        
        try {
            const json = JSON.parse(text);
            console.log("\nParsed JSON:");
            console.log(JSON.stringify(json, null, 2));
            
            // Validate required fields
            const requiredFields = ['name', 'symbol', 'description', 'image'];
            const missingFields = requiredFields.filter(field => !json[field]);
            
            if (missingFields.length > 0) {
                console.log("\n⚠️ Missing required fields:", missingFields.join(', '));
            } else {
                console.log("\n✅ All required fields present");
            }

            // Check if image URL is accessible
            console.log("\nChecking image URL...");
            const imageResponse = await fetch(json.image);
            if (imageResponse.ok) {
                console.log("✅ Image URL is accessible");
                console.log("Image Content-Type:", imageResponse.headers.get('content-type'));
            } else {
                console.log("❌ Image URL is not accessible:", imageResponse.status, imageResponse.statusText);
            }
        } catch (e) {
            console.log("\n❌ JSON parsing error:", e.message);
        }
    } catch (error) {
        console.log("\n❌ Fetch error:", error.message);
    }
}

checkMetadataUri().catch(console.error);