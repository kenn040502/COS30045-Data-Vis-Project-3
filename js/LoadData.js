// Load both the dataset and the Australia GeoJSON map together
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
    year: +d.YEAR,
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
.catch(error => console.error("Error loading data or map:", error));