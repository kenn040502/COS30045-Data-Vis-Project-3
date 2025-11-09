function drawChart4(data, geoData, selectedYear = 2024) {
  d3.select("#chart4").selectAll("*").remove(); 
  const width = 900;
  const height = 700;
  const svg = d3.select("#chart4").append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  const tooltip = d3.select("#chart4").append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "rgba(255,255,255,0.95)")
    .style("border", "1px solid #ccc")
    .style("border-radius", "6px")
    .style("padding", "8px 40px")
    .style("font-size", "13px")
    .style("pointer-events", "none")
    .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
    .style("opacity", 0);

  const projection = d3.geoMercator()
    .center([134, -28])
    .scale(800)
    .translate([width / 2, height / 2]); 

  const path = d3.geoPath().projection(projection);
  const roadsideDrugs = ["AMPHETAMINE", "CANNABIS", "ECSTASY"];

  const filtered = data.filter(
    d => +d.year >= 2021 && 
    d.bestDetectionMethod?.toLowerCase() === "yes"
  );

  const grouped = d3.rollup(
    filtered,
    v => {
      const totals = {};
      roadsideDrugs.forEach(drug => {
        totals[drug] = d3.sum(v, d =>
          d[drug.toLowerCase()]?.trim().toLowerCase() === "yes" ? +d.count : 0
        );
      });
      const dominantDrug = roadsideDrugs.reduce((a, b) =>
        totals[a] > totals[b] ? a : b
      );
      totals.total = d3.sum(Object.values(totals));
      totals.dominantDrug = dominantDrug;
      return totals;
    },
    d => d.jurisdiction.trim().toLowerCase()
  );

  const jurisdictionMap = {
    "nsw": "new south wales",
    "vic": "victoria",
    "qld": "queensland",
    "wa": "western australia",
    "sa": "south australia",
    "tas": "tasmania",
    "nt": "northern territory",
  };

  const normalizedGrouped = new Map();
  grouped.forEach((val, key) => {
    const full = jurisdictionMap[key.toLowerCase()] || key;
    normalizedGrouped.set(full, val);
  });

  const color = d3.scaleOrdinal()
    .domain(roadsideDrugs)
    .range(["#4CAF50", "#FF7043", "#42A5F5"]);

  // Draw map
  svg.selectAll("path")
    .data(geoData.features)
    .join("path")
    .attr("d", path)
    .attr("fill", d => {
      const name =
        (d.properties.STATE_NAME ||
         d.properties.STE_NAME16 ||
         d.properties.name || "")
         .trim().toLowerCase();
      const stats = normalizedGrouped.get(name);
      return stats && stats.total > 0 ? color(stats.dominantDrug) : "#e0e0e0"; // gray for no data
    })
    .attr("stroke", "#555")
    .attr("stroke-width", 1)
    .on("mouseover", (event, d) => {
      const name =
        (d.properties.STATE_NAME ||
         d.properties.STE_NAME16 ||
         d.properties.name || "")
         .trim().toLowerCase();
      const stats = normalizedGrouped.get(name);
      if (stats) {
        tooltip.transition().duration(150).style("opacity", 1);
        tooltip.html(`
          <strong>${d.properties.STATE_NAME}</strong><br/>
          <strong>Dominant Drug:</strong> ${stats.dominantDrug}<br/>
          <strong>Total Positive:</strong> ${stats.total.toLocaleString()}<br/><br/>
          ${roadsideDrugs
            .map(drug => `${drug}: ${stats[drug].toLocaleString()}`)
            .join("<br/>")}
        `);
      }
    })
    .on("mousemove", (event) => {
      tooltip.style("left", (event.pageX + 12) + "px")
             .style("top", (event.pageY - 20) + "px");
    })
    .on("mouseout", () => tooltip.transition().duration(200).style("opacity", 0));

  svg.selectAll(".state-label")
    .data(geoData.features)
    .join("text")
    .attr("class", "state-label")
    .attr("transform", d => `translate(${path.centroid(d)})`)
    .attr("text-anchor", "middle")
    .attr("alignment-baseline", "middle")
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .style("fill", "#000")
    .style("pointer-events", "none")
    .text(d => d.properties.STATE_NAME || d.properties.name);

  // Move legend below the map
  const legend = svg.append("g")
    .attr("transform", `translate(${width / 2 - 80}, ${height - 50})`);

  roadsideDrugs.forEach((drug, i) => {
    legend.append("rect")
      .attr("x", i * 140)
      .attr("y", 0)
      .attr("width", 18)
      .attr("height", 18)
      .attr("fill", color(drug));

    legend.append("text")
      .attr("x", i * 140 + 25)
      .attr("y", 13)
      .style("font-size", "13px")
      .text(drug);
  });

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", 30)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .style("font-weight", "bold")
    .text(`Dominant Roadside Drug Detections by Jurisdiction (${selectedYear})`);

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("fill", "#555")
    .text("Note: Data prior to 2021 and NT data (2023–2024) unavailable due to data quality issues. NSW confirmatory testing discontinued since Sept 2024.");
  }

// Add dropdown listener
d3.select("#yearSelect").on("change", function() {
  const selectedYear = this.value;
  drawChart4(data, geoData, selectedYear);
});
