function drawChart4(data, geoData) {

  d3.select("#chart4").selectAll("*").remove();

  const width = 900;
  const height = 700;

  const svg = d3.select("#chart4").append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`);

  // Tooltip
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

  // Drugs
  const roadsideDrugs = [
    "Amphetamine",
    "Cannabis",
    "Ecstasy",
    "Methylamphetamine"
  ];

  const drugColors = {
    Amphetamine: "#4CAF50",
    Cannabis: "#FF7043",
    Ecstasy: "#42A5F5",
    Methylamphetamine: "#9C27B0"
  };

  // Build stats map
  const statsMap = new Map();
  data.forEach(d => {
    statsMap.set(d.JURISDICTION.trim().toLowerCase(), {
      total: +d.totalPositive,
      Amphetamine: +d.ampPct,
      Cannabis: +d.canPct,
      Ecstasy: +d.ecsPct,
      Methylamphetamine: +d.metPct
    });
  });

  const jurisdictionMap = {
    nsw: "new south wales",
    vic: "victoria",
    qld: "queensland",
    wa: "western australia",
    sa: "south australia",
    tas: "tasmania",
    nt: "northern territory",
    act: "australian capital territory"
  };

  // Normalize to match GeoJSON
  const normalizedStats = new Map();
  statsMap.forEach((value, key) => {
    const full = jurisdictionMap[key] || key;
    normalizedStats.set(full, value);
  });

  const defs = svg.append("defs");

  function createGradient(name, stats, feature) {
    const id = "grad-" + name.replace(/\s+/g, "-");
    defs.select("#" + id).remove();

    // Identify largest polygon
    let largest = null;
    let maxArea = -Infinity;

    feature.geometry.coordinates.forEach(poly => {
        const area = d3.polygonArea(poly[0]);
        if (Math.abs(area) > maxArea) {
            maxArea = Math.abs(area);
            largest = poly[0];
        }
    });

    // Project coordinates into screen space
    const projectedPoints = largest.map(p => projection(p));

    const xs = projectedPoints.map(p => p[0]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);

    const grad = defs.append("linearGradient")
        .attr("id", id)
        .attr("gradientUnits", "userSpaceOnUse")
        .attr("x1", minX)
        .attr("y1", 0)
        .attr("x2", maxX)
        .attr("y2", 0);

    // Build slices
    const drugs = ["Amphetamine", "Cannabis", "Ecstasy", "Methylamphetamine"];
    let accumulated = 0;

    drugs.forEach(drug => {
        const pct = stats[drug];
        if (pct > 0) {
            grad.append("stop")
                .attr("offset", `${accumulated}%`)
                .attr("stop-color", drugColors[drug]);

            accumulated += pct;

            grad.append("stop")
                .attr("offset", `${accumulated}%`)
                .attr("stop-color", drugColors[drug]);
        }
    });

    return `url(#${id})`;
}



  function getDominantDrug(stats) {
    return roadsideDrugs.reduce((a, b) =>
      stats[a] > stats[b] ? a : b
    );
  }

  const defaultFill = "#f4f6f8";
  const defaultStroke = "#c9d3d9";
  let selected = null;

  // Draw states
  const states = svg.selectAll("path")
    .data(geoData.features)
    .join("path")
    .attr("d", path)
    .attr("fill", d => {
      const n = (d.properties.STATE_NAME || "").trim().toLowerCase();
      const stats = normalizedStats.get(n);
      return stats ? drugColors[getDominantDrug(stats)] : defaultFill;
    })
    .attr("stroke", defaultStroke)
    .attr("stroke-width", 0.8)
    .style("cursor", "pointer");

  // Hover
  states.on("mouseenter", function (event, d) {
    const name = (d.properties.STATE_NAME ||
      d.properties.STE_NAME16 ||
      d.properties.name ||
      ""
    ).trim().toLowerCase();

    const stats = normalizedStats.get(name);

    // If this is NOT the selected state → highlight border
    if (selected !== name) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr("stroke", "#333")
        .attr("stroke-width", 2);
    }

    // =========================================
    // TOOLTIP LOGIC
    // =========================================

    if (selected === null) {
      // NOTHING SELECTED → show detailed tooltip
      if (stats && stats.total > 0) {
          tooltip.html(`
              <strong>${d.properties.STATE_NAME}</strong><br>
              Total Positive: ${stats.total}<br><br>
              Amphetamine: ${stats.Amphetamine || 0}%<br>
              Cannabis: ${stats.Cannabis || 0}%<br>
              Ecstasy: ${stats.Ecstasy || 0}%<br>
          `);
      } else {
          tooltip.html(`<strong>${d.properties.STATE_NAME}</strong><br><em>No data</em>`);
      }
    } else {
        // ANOTHER STATE IS SELECTED → show only “Click to explore”
        if (selected !== name) {
            tooltip.html(`
              <strong>${d.properties.STATE_NAME}</strong><br/>
              <em>Click to explore</em>
            `);
        } else {
            // Hover over the selected state → show NOTHING (panel already visible)
            return;
        }
    }

    tooltip
        .style("left", event.pageX + 15 + "px")
        .style("top", event.pageY - 20 + "px")
        .transition()
        .duration(150)
        .style("opacity", 1);
  })

  .on("mouseleave", function (event, d) {
      const name = (d.properties.STATE_NAME ||
        d.properties.STE_NAME16 ||
        d.properties.name ||
        ""
      ).trim().toLowerCase();

      if (selected !== name) {
          d3.select(this)
              .transition()
              .duration(180)
              .attr("stroke-width", 0.8)
      }

      tooltip.transition().duration(150).style("opacity", 0);
  });

  // CLICK
  states.on("click", function (event, d) {
    const name = (d.properties.STATE_NAME || "").trim().toLowerCase();
    const stats = normalizedStats.get(name);

    // RESET state
    if (selected === name) {
      selected = null;

      states.transition().duration(300)
        .attr("fill", d => {
          const nm = (d.properties.STATE_NAME || "").trim().toLowerCase();
          const st = normalizedStats.get(nm);
          return st ? drugColors[getDominantDrug(st)] : defaultFill;
        })
        .attr("stroke", defaultStroke)
        .attr("stroke-width", 0.8);

      svg.select("#statsPanel").remove();
      return;
    }

    selected = name;

    // Grey out all others
    states.transition().duration(300)
      .attr("fill", d => {
        const nm = (d.properties.STATE_NAME || "").trim().toLowerCase();
        return nm === name ? null : "#e0e0e0";
      })
      .attr("stroke", d => {
        const nm = (d.properties.STATE_NAME || "").trim().toLowerCase();
        return nm === name ? "#333" : defaultStroke;
      })
      .attr("stroke-width", d => {
        const nm = (d.properties.STATE_NAME || "").trim().toLowerCase();
        return nm === name ? 2 : 0.8;
      });

    svg.select("#statsPanel").remove();

    // NO DATA MODE
    if (!stats || stats.total === 0) {
      const panel = svg.append("g")
        .attr("id", "statsPanel")
        .attr("transform", `translate(${width / 2 - 330}, ${height - 140})`);

      panel.append("rect")
        .attr("width", 360)
        .attr("height", 85)
        .attr("rx", 8)
        .attr("ry", 8)
        .attr("fill", "rgba(255,255,255,0.97)")
        .attr("stroke", "#ddd");

      panel.append("text")
        .attr("x", 180)
        .attr("y", 25)
        .attr("text-anchor", "middle")
        .style("font-size", "15px")
        .style("font-weight", "bold")
        .style("fill", "#ff9800")
        .text(`${d.properties.STATE_NAME}`);

      const noDataMsg = panel.append('text')
        .attr("x", 180)
        .attr("y", 50)
        .attr("text-anchor", "middle")
        .style("font-size", "13px")
        .style("fill", "#999")
        .text("No data available for this jurisdiction");

      noDataMsg.transition().duration(400).delay(150).style('opacity', 1);
      
      // Helpful hint with animation
      const noDataHint = panel.append('text')
        .attr('x', 180)
        .attr('y', 68)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('fill', '#bbb')
        .style('font-style', 'italic')
        .style('opacity', 0)
        .text('(Data prior to 2021 unavailable. NT data limited.)');
      
      noDataHint.transition().duration(400).delay(200).style('opacity', 1);

      return;
    }

    // NORMAL MODE — apply gradient
    const gradFill = createGradient(name, stats, d);
    d3.select(this).transition().duration(600)
      .attr("fill", gradFill);

    // Remove existing panel
    svg.select("#statsPanel").remove();

    // Create panel
    const panel = svg.append("g")
      .attr("id", "statsPanel")
      .attr("transform", `translate(${width / 2 - 330}, ${height - 140 + 30})`)  // start lower (for slide animation)
      .style("opacity", 0);

    // Background
    panel.append("rect")
      .attr("width", 480)
      .attr("height", 95)
      .attr("rx", 8)
      .attr("ry", 8)
      .attr("fill", "rgba(255,255,255,0.97)")
      .attr("stroke", "#bbb");

    // Slide + fade animation
    panel.transition()
      .duration(450)
      .style("opacity", 1)
      .attr("transform", `translate(${width / 2 - 330}, ${height - 140})`);

    // Title
    panel.append("text")
      .attr("x", 240)
      .attr("y", 22)
      .attr("text-anchor", "middle")
      .style("font-size", "15px")
      .style("font-weight", "bold")
      .style("opacity", 0)
      .text(`${d.properties.STATE_NAME} — Statistics`)
      .transition()
      .duration(350)
      .delay(150)
      .style("opacity", 1);

    // Total tests
    panel.append("text")
      .attr("x", 240)
      .attr("y", 44)
      .attr("text-anchor", "middle")
      .style("font-size", "13px")
      .style("opacity", 0)
      .text(`Total Positive Tests: ${stats.total}`)
      .transition()
      .duration(350)
      .delay(250)
      .style("opacity", 1);

    // Drug breakdown
    roadsideDrugs.forEach((drug, i) => {
      const group = panel.append("g")
        .attr("transform", `translate(${30 + i * 110}, 65)`)
        .style("opacity", 0);

      group.append("circle")
        .attr("r", 7)
        .attr("fill", drugColors[drug]);

      group.append("text")
        .attr("x", 14)
        .attr("y", 4)
        .style("font-size", "11px")
        .text(`${drug}`);

      group.append("text")
        .attr("x", 14)
        .attr("y", 15)
        .style("font-size", "10px")
        .style("fill", "#666")
        .text(`${stats[drug]}%`);

      // Animated reveal
      group.transition()
        .duration(300)
        .delay(350 + i * 150)
        .style("opacity", 1);
    });
  });

  // Labels
  svg.selectAll(".state-label")
    .data(geoData.features)
    .join("text")
    .attr("class", "state-label")
    .attr("transform", d => `translate(${path.centroid(d)})`)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .style("font-weight", "bold")
    .text(d => d.properties.STATE_NAME);

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 10)
    .attr("text-anchor", "middle")
    .style("font-size", "11px")
    .style("fill", "#555")
    .text("Note: Data prior to 2021 and NT data (2023-2024) unavailable due to data quality issues. NSW confirmatory testing discontinued since Sept 2024.")
    .text("Note: Data for Australia Capital Territory data are not shown due to the constraints on showing its location on the map.");
}
