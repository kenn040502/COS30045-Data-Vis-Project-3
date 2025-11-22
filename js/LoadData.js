// ===========================
// Load Chart5Data.csv (Age groups)
// ===========================
if (typeof drawChart1 === "function") {
    d3.csv("data/Chart5Data.csv", d => ({
        AGE_GROUP: d["AGE_GROUP"],
        2023: +d["2023"],
        2024: +d["2024"]
    }))
    .then(chart1Data => {
        console.log("Chart5Data loaded:", chart1Data);
        drawChart1(chart1Data);
    })
    .catch(error => {
        console.error("Error loading Chart5Data:", error);
    });
} else {
    console.warn("drawChart1 not found; skipping Chart5Data load.");
}


// ===========================
// Load Chart4Data + GeoJSON for location analysis
// ===========================
if (typeof drawChart4 === "function") {
    Promise.all([
        d3.csv("data/Chart4Data.csv", d => ({

            location: d["LOCATION"],

            // POSITIVE TESTS
            nswPos: +d["NSW Total Positive Test"],
            vicPos: +d["VIC Total Positive Test"],
            qldPos: +d["QLD Total Positive Test"],
            saPos: +d["SA Total Positive Test"],
            tasPos: +d["TAS Total Positive Test"],
            waPos: +d["WA Total Positive Test"],
            ntPos: +d["NT Total Positive Test"],
            actPos: +d["ACT Total Positive Test"],

            // TOTAL TESTS
            nswTotal: +d["NSW Total Tests"],
            vicTotal: +d["VIC Total Tests"],
            qldTotal: +d["QLD Total Tests"],
            saTotal: +d["SA Total Tests"],
            tasTotal: +d["TAS Total Tests"],
            waTotal: +d["WA Total Tests"],
            ntTotal: +d["NT Total Tests"],
            actTotal: +d["ACT Total Tests"],

            // Combined
            totalTests: +d["Total Tests"],
            totalPositive: +d["Total Positive"],
            positiveRate: +d["Positive Percentage by location"]
        })),

        d3.json("data/australia_states.geojson")
    ])
    .then(([aggData, geoData]) => {
        console.log("Chart4Data loaded:", aggData.length, "rows");
        console.log("GeoJSON loaded:", geoData.features.length, "features");
        drawChart4(aggData, geoData);
    })
    .catch(error => console.error("Error loading Chart4Data:", error));
} else {
    console.warn("drawChart4 not found; skipping Chart4Data load.");
}


// ===========================
// Load Chart3Data + GeoJSON
// ===========================
if (typeof drawChart3 === "function") {
    Promise.all([
        d3.csv("data/Chart3Data.csv", d => ({
            JURISDICTION: (d["JURISDICTION"] || "").trim().toLowerCase(),
            totalPositive: +d["Total Positive Tests"],

            ampPct: parseFloat(d["Amphetamine Percentage"]),
            canPct: parseFloat(d["Cannabis Percentage"]),
            ecsPct: parseFloat(d["Ecstasy Percentage"]),
            metPct: parseFloat(d["Methylamphetamine Percentage"])
        })),

        d3.json("data/australia_states.geojson")
    ])
    .then(([chart3Data, geoData]) => {
        console.log("Chart3Data loaded:", chart3Data.length, "rows");
        console.log("GeoJSON loaded:", geoData.features.length, "features");
        drawChart3(chart3Data, geoData);
    })
    .catch(error => console.error("Error loading Chart3Data:", error));
} else {
    console.warn("drawChart3 not found; skipping Chart3Data load.");
}
