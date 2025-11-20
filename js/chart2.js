// js/chart2.js
// Chart 2 - Which drug types are most frequently detected in each jurisdiction (map)

(async function () {
  let rows, geo;
  try {
    [rows, geo] = await Promise.all([
      d3.csv("data/cleanedData.csv"),
      d3.json("australian-states.json")
    ]);
  } catch (err) {
    console.error("chart2 - data load error:", err);
    d3.select("#chart2")
      .append("div")
      .style("padding", "0.75rem")
      .style("font-size", "0.8rem")
      .text("Could not load cleanedData.csv or australian-states.json");
    return;
  }

  const jurisToStateName = {
    NSW: "New South Wales",
    VIC: "Victoria",
    QLD: "Queensland",
    SA:  "South Australia",
    WA:  "Western Australia",
    TAS: "Tasmania",
    NT:  "Northern Territory",
    ACT: "Australian Capital Territory"
  };

  const stateNameToAbbrev = {};
  Object.entries(jurisToStateName).forEach(([abbr, name]) => {
    stateNameToAbbrev[name] = abbr;
  });

  const DRUG_COLS = ["AMPHETAMINE", "CANNABIS", "ECSTASY"];

  const drugColorMap = {
    Amphetamine: "#f97316", // orange
    Cannabis:    "#22c55e", // green
    Ecstasy:     "#6366f1"  // blue
  };

  rows.forEach(d => {
    d.year = +(d.year || d.YEAR || 0);
    d.jurisdiction = (d.JURISDICTION || d.jurisdiction || "").trim();
    d.positive_count = +(
      d.COUNT ||
      d.count ||
      d.POSITIVE_COUNT ||
      d.positive_count ||
      0
    );

    DRUG_COLS.forEach(col => {
      const v = (d[col] || d[col.toLowerCase()] || "")
        .toString()
        .trim()
        .toLowerCase();
      d[col] = v;
    });
  });

  const stateTotals = new Map();

  rows.forEach(d => {
    const stateName = jurisToStateName[d.jurisdiction];
    if (!stateName) return;

    let entry = stateTotals.get(stateName);
    if (!entry) {
      entry = { Amphetamine: 0, Cannabis: 0, Ecstasy: 0 };
      stateTotals.set(stateName, entry);
    }

    if (d.AMPHETAMINE === "yes") entry.Amphetamine += d.positive_count;
    if (d.CANNABIS === "yes")    entry.Cannabis    += d.positive_count;
    if (d.ECSTASY === "yes")     entry.Ecstasy     += d.positive_count;
  });

  const topByState = new Map();
  for (const [stateName, totals] of stateTotals.entries()) {
    let bestDrug = null;
    let bestVal = 0;
    for (const [drug, val] of Object.entries(totals)) {
      if (val > bestVal) {
        bestVal = val;
        bestDrug = drug;
      }
    }
    if (bestDrug) {
      topByState.set(stateName, { drug: bestDrug, total: bestVal });
    }
  }

  const container = d3.select("#chart2");
  container.selectAll("*").remove();
  const infoBox = d3.select("#chart2-info");

  if (!geo || !geo.features) {
    container
      .append("div")
      .style("padding", "0.75rem")
      .style("font-size", "0.8rem")
      .text("GeoJSON has no features — cannot draw map.");
    return;
  }

  const bounds = container.node().getBoundingClientRect();
  const width = bounds.width || window.innerWidth;
  const height = bounds.height || Math.max(window.innerHeight - 160, 450);
  const margin = { top: 8, right: 8, bottom: 8, left: 8 };

  const svg = container
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("width", "100%")
    .attr("height", height);

  const projection = d3.geoMercator().fitSize(
    [width - margin.left - margin.right, height - margin.top - margin.bottom],
    geo
  );
  const path = d3.geoPath().projection(projection);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const tooltip = container
    .append("div")
    .attr("class", "map-tooltip")
    .style("position", "absolute")
    .style("pointer-events", "none")
    .style("background", "rgba(0,0,0,0.9)")
    .style("color", "#fff")
    .style("padding", "6px 10px")
    .style("border-radius", "6px")
    .style("font-size", "0.75rem")
    .style("box-shadow", "0 8px 16px rgba(0,0,0,0.35)")
    .style("opacity", 0);

  const containerNode = container.node();

  function showTooltip(event, d) {
    const [mx, my] = d3.pointer(event, containerNode);
    const stateName = d.properties.STATE_NAME;
    const abbrev = stateNameToAbbrev[stateName] || "";
    const info = topByState.get(stateName);

    let html = "";
    if (abbrev) {
      html += `<strong>${abbrev} — ${stateName}</strong><br>`;
    } else {
      html += `<strong>${stateName}</strong><br>`;
    }

    if (info) {
      html += `${info.drug} (${info.total.toLocaleString()} positives)`;
    } else {
      html += "No positives recorded for these drugs";
    }

    tooltip
      .style("opacity", 1)
      .html(html)
      .style("left", mx + 8 + "px")
      .style("top", my + 8 + "px");
  }

  function hideTooltip() {
    tooltip.style("opacity", 0);
  }

  function updateInfoBoxFromFeature(d) {
    const stateName = d.properties.STATE_NAME;
    const abbrev = stateNameToAbbrev[stateName] || stateName;
    const info = topByState.get(stateName);
    if (info) {
      infoBox.html(
        `<strong>${abbrev}</strong>: ${info.drug} (${info.total.toLocaleString()} positives)`
      );
    } else {
      infoBox.html(`<strong>${abbrev}</strong>: No positives recorded for these drugs`);
    }
  }

  // Draw states with fade-in animation
  const states = g.selectAll("path.state")
    .data(geo.features)
    .enter()
    .append("path")
    .attr("class", "state-region")
    .attr("d", path)
    .attr("fill", d => {
      const info = topByState.get(d.properties.STATE_NAME);
      return info ? drugColorMap[info.drug] : "#f4f4f4";
    })
    .attr("stroke", "#e5e7eb")
    .attr("stroke-width", 1)
    .attr("opacity", 0)
    .on("mousemove", showTooltip)
    .on("mouseenter", function (event, d) {
      showTooltip(event, d);
      updateInfoBoxFromFeature(d);
      d3.select(this)
        .transition()
        .duration(200)
        .attr("stroke", "#111827")
        .attr("stroke-width", 1.8);
    })
    .on("mouseleave", function () {
      hideTooltip();
      d3.select(this)
        .transition()
        .duration(200)
        .attr("stroke", "#e5e7eb")
        .attr("stroke-width", 1);
    })
    .on("click", (event, d) => {
      updateInfoBoxFromFeature(d);
    });

  states
    .transition()
    .duration(750)
    .delay((_, i) => i * 60)
    .attr("opacity", 1);

  // Legend
  const legend = svg.append("g")
    .attr("transform", `translate(${width - 170}, ${margin.top + 10})`);

  ["Amphetamine", "Cannabis", "Ecstasy"].forEach((drug, i) => {
    const row = legend.append("g").attr("transform", `translate(0, ${i * 22})`);
    row.append("rect")
      .attr("width", 14)
      .attr("height", 14)
      .attr("rx", 3)
      .attr("fill", drugColorMap[drug]);
    row.append("text")
      .attr("x", 20)
      .attr("y", 11)
      .style("font-size", "12px")
      .style("font-weight", "600")
      .text(drug);
  });

  // Seed info with NSW (or first available)
  const initialFeature = geo.features.find(f => f.properties.STATE_NAME === "New South Wales") || geo.features[0];
  if (initialFeature) updateInfoBoxFromFeature(initialFeature);
})();
