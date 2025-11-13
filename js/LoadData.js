// ===========================
// Load Chart1Data.csv
// ===========================
d3.csv("data/Chart1Data.csv", d => ({
    AGE_GROUP: d["AGE_GROUP"],
    2023: +d["2023"],
    2024: +d["2024"]
}))
.then(chart1Data => {
    console.log("Chart1Data loaded:", chart1Data);
    drawChart1(chart1Data);
})
.catch(error => {
    console.error("Error loading Chart1Data:", error);
});


// ===========================
// Load cleanedData + GeoJSON
// For Chart2 (Radar + Choropleth)
// ===========================
Promise.all([
    d3.csv("data/cleanedData.csv", d => ({
        jurisdiction: d.JURISDICTION,
        location: d.LOCATION,
        ageGroup: d.AGE_GROUP,
        bestDetectionMethod: d.BEST_DETECTION_METHOD,
        detectionMethod: d.DETECTION_METHOD,
        amphetamine: d.AMPHETAMINE,
        cannabis: d.CANNABIS,
        ecstasy: d.ECSTASY,
        noDrugsDetected: +d.NO_DRUGS_DETECTED,
        count: +d.COUNT,
        year: +d.YEAR
    })),
    d3.json("data/australia_states.geojson")
])
.then(([data, geoData]) => {

    console.log("cleanedData loaded:", data.length, "rows");
    console.log("GeoJSON loaded:", geoData.features.length, "features");

    // Your combined interactive radar + map
    drawChart2(data, geoData); 
    drawChart4(data, geoData); // Geo map chart 
})
.catch(error => console.error("Error loading data or map:", error));
