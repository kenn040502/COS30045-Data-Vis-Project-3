// ===========================
// Load Chart1Data.csv  (Age groups)
// ===========================
if (typeof drawChart1 === "function") {
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
} else {
    console.warn("drawChart1 not found; skipping Chart1Data load.");
}


// ===========================
// Load AGGREGATED DATA + GeoJSON
// for Chart2 (Radar + Choropleth)
// ===========================
if (typeof drawChart2 === "function") {
    Promise.all([
        d3.csv("data/Chart2Data.csv", d => ({

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
        console.log("Chart2Data loaded:", aggData.length, "rows");
        console.log("GeoJSON loaded:", geoData.features.length, "features");
        drawChart2(aggData, geoData);
    })
    .catch(error => console.error("Error loading Chart2Data:", error));
} else {
    console.warn("drawChart2 not found; skipping Chart2Data load.");
}


// ===========================
// Load NEW Chart4 dataset + GeoJSON
// ===========================
if (typeof drawChart4 === "function") {
    Promise.all([
        d3.csv("data/Chart4Data.csv", d => ({
            JURISDICTION: d["JURISDICTION"].trim().toLowerCase(),
            totalPositive: +d["Total Positive Tests"],

            ampPct: parseFloat(d["Amphetamine Percentage"]),
            canPct: parseFloat(d["Cannabis Percentage"]),
            ecsPct: parseFloat(d["Ecstasy Percentage"]),
            metPct: parseFloat(d["Methylamphetamine Percentage"])
        })),

        d3.json("data/australia_states.geojson")
    ])
    .then(([chart4Data, geoData]) => {
        console.log("Chart4Data loaded:", chart4Data.length, "rows");
        console.log("GeoJSON loaded:", geoData.features.length, "features");
        drawChart4(chart4Data, geoData);
    })
    .catch(error => console.error("Error loading Chart4Data:", error));
} else {
    console.warn("drawChart4 not found; skipping Chart4Data load.");
}
