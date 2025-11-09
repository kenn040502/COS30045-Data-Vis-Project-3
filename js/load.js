// Load both the dataset and the Australia GeoJSON map together
Promise.all([
  d3.csv("data/police_enforcement_2024_positive_drug_tests.csv", d => ({
    year: +d.YEAR,
    startDate: d.START_DATE,
    endDate: d.END_DATE,
    jurisdiction: d.JURISDICTION,
    location: d.LOCATION,
    ageGroup: d.AGE_GROUP,
    metric: d.METRIC,
    bestDetectionMethod: d.BEST_DETECTION_METHOD,
    detectionMethod: d.DETECTION_METHOD,
    amphetamine: d.AMPHETAMINE,
    cannabis: d.CANNABIS,
    cocaine: d.COCAINE,
    ecstasy: d.ECSTASY,
    methylamphetamine: d.METHYLAMPHETAMINE,
    other: d.OTHER,
    unknown: d.UNKNOWN,
    noDrugsDetected: +d.NO_DRUGS_DETECTED,
    count: +d.COUNT,
    fines: +d.FINES,
    arrests: +d.ARRESTS,
    charges: +d.CHARGES
  })),
  d3.json("data/australia_states.geojson")
])
.then(([data, geoData]) => {
  console.log("Data loaded:", data.length, "rows");
  console.log("GeoJSON loaded:", geoData.features.length, "features");

  // Call all your charts
  drawChart1(data);
  drawChart2(data);
  drawChart4(data, geoData); // Geo map chart
})
.catch(error => console.error("❌ Error loading data or map:", error));
