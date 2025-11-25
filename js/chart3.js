function drawChart3(data, geoData) {
  const container = d3.select("#chart3");
  container.selectAll("*").remove();
  container.style("position", "relative");

  const bounds = container.node().getBoundingClientRect();
  const width = Math.min(Math.max(360, bounds.width || window.innerWidth), 840);
  const height = Math.max(320, Math.min(bounds.height || width * 0.48, 500));

  const svg = container.append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("width", "100%")
    .attr("height", "100%");

  const mapGroup = svg.append("g").attr("class", "map-group");

  // Tooltip
  const tooltip = container.append("div")
    .attr("class", "tooltip")
    .style("position", "absolute")
    .style("background", "rgba(255,255,255,0.95)")
    .style("border", "1px solid #ccc")
    .style("border-radius", "6px")
    .style("padding", "8px 16px")
    .style("font-size", "12px")
    .style("pointer-events", "none")
    .style("box-shadow", "0 2px 8px rgba(0,0,0,0.15)")
    .style("opacity", 0);
  const moveTooltip = (event) => {
    const rect = container.node().getBoundingClientRect();
    const x = event.clientX - rect.left + 14;
    const y = event.clientY - rect.top - 18;
    tooltip
      .style("left", `${x}px`)
      .style("top", `${y}px`);
  };

  const projection = d3.geoMercator()
    .center([134, -28])
    .scale(400)
    .translate([width / 2, height / 2 - 60]);

  const path = d3.geoPath().projection(projection);

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

  const normalizedStats = new Map();
  statsMap.forEach((value, key) => {
    const full = jurisdictionMap[key] || key;
    normalizedStats.set(full, value);
  });

  const defs = svg.append("defs");

  function createGradient(name, stats, feature) {
    const id = "grad-" + name.replace(/\s+/g, "-");
    defs.select("#" + id).remove();

    let largest = null;
    let maxArea = -Infinity;

    feature.geometry.coordinates.forEach(poly => {
      const area = d3.polygonArea(poly[0]);
      if (Math.abs(area) > maxArea) {
        maxArea = Math.abs(area);
        largest = poly[0];
      }
    });

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

    let accumulated = 0;
    roadsideDrugs.forEach(drug => {
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
  const states = mapGroup.selectAll("path")
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
    .attr("opacity", 0)
    .style("cursor", "pointer");

  states.transition()
    .duration(650)
    .delay((_, i) => i * 80)
    .attr("opacity", 1);

  // Hover tooltip
  states.on("mouseenter", function (event, d) {
    const name = (d.properties.STATE_NAME ||
      d.properties.STE_NAME16 ||
      d.properties.name ||
      ""
    ).trim().toLowerCase();

    const stats = normalizedStats.get(name);

    if (selected !== name) {
      d3.select(this)
        .transition()
        .duration(200)
        .attr("stroke", "#333")
        .attr("stroke-width", 2);
    }

    if (selected === null) {
      if (stats && stats.total > 0) {
        tooltip.html(`
          <strong>${d.properties.STATE_NAME}</strong><br>
          Total Positive: ${stats.total}<br><br>
          Amphetamine: ${stats.Amphetamine || 0}%<br>
          Cannabis: ${stats.Cannabis || 0}%<br>
          Ecstasy: ${stats.Ecstasy || 0}%<br>
          Methylamphetamine: ${stats.Methylamphetamine || 0}%
        `);
      } else {
        tooltip.html(`<strong>${d.properties.STATE_NAME}</strong><br><em>No data</em>`);
      }
    } else {
      if (selected !== name) {
        tooltip.html(`
          <strong>${d.properties.STATE_NAME}</strong><br/>
          <em>Click to explore</em>
        `);
      } else {
        return;
      }
    }

    const [mouseX, mouseY] = d3.pointer(event, container.node());

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
          .attr("stroke", defaultStroke);
      }

      tooltip.transition().duration(150).style("opacity", 0);
    });

  // CLICK – stats panel (narrow & tall)
  states.on("click", function (event, d) {
    const name = (d.properties.STATE_NAME || "").trim().toLowerCase();
    const stats = normalizedStats.get(name);

    // Narrower + taller panel
    const basePanelWidth = 260;    // narrower
    const basePanelHeight = 130;   // taller
    const panelWidth = Math.min(basePanelWidth, width * 0.8);
    const panelHeight = basePanelHeight;
    const panelX = (width - panelWidth) / 2;
    const panelY = height - panelHeight - 22;

    // Reset
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

    // Grey out others
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

    // NO DATA PANEL
    if (!stats || stats.total === 0) {
      const panel = svg.append("g")
        .attr("id", "statsPanel")
        .attr("transform", `translate(${panelX}, ${panelY + 30})`)
        .style("opacity", 0);

      panel.append("rect")
        .attr("width", panelWidth)
        .attr("height", panelHeight)
        .attr("rx", 8)
        .attr("ry", 8)
        .attr("fill", "rgba(255,255,255,0.97)")
        .attr("stroke", "#bbb");

      panel.transition()
        .duration(450)
        .style("opacity", 1)
        .attr("transform", `translate(${panelX}, ${panelY})`);

      panel.append("text")
        .attr("x", panelWidth / 2)
        .attr("y", 24)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("fill", "#ff9800")
        .text(`${d.properties.STATE_NAME}`)
        .style("opacity", 0)
        .transition()
        .duration(350)
        .delay(150)
        .style("opacity", 1);

      panel.append("text")
        .attr("x", panelWidth / 2)
        .attr("y", 50)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#999")
        .text("No data available for this jurisdiction")
        .style("opacity", 0)
        .transition()
        .duration(350)
        .delay(250)
        .style("opacity", 1);

      panel.append("text")
        .attr("x", panelWidth / 2)
        .attr("y", 70)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "#bbb")
        .style("font-style", "italic")
        .text("(Data prior to 2021 unavailable. NT data limited.)")
        .style("opacity", 0)
        .transition()
        .duration(350)
        .delay(350)
        .style("opacity", 1);

      return;
    }

    // NORMAL MODE – gradient fill
    const gradFill = createGradient(name, stats, d);
    d3.select(this).transition().duration(600)
      .attr("fill", gradFill);

    const panel = svg.append("g")
      .attr("id", "statsPanel")
      .attr("transform", `translate(${panelX}, ${panelY + 30})`)
      .style("opacity", 0);

    panel.append("rect")
      .attr("width", panelWidth)
      .attr("height", panelHeight)
      .attr("rx", 8)
      .attr("ry", 8)
      .attr("fill", "rgba(255,255,255,0.97)")
      .attr("stroke", "#bbb");

    panel.transition()
      .duration(450)
      .style("opacity", 1)
      .attr("transform", `translate(${panelX}, ${panelY})`);

    panel.append("text")
      .attr("x", panelWidth / 2)
      .attr("y", 22)
      .attr("text-anchor", "middle")
      .style("font-size", "14px")
      .style("font-weight", "bold")
      .style("opacity", 0)
      .text(`${d.properties.STATE_NAME} - Statistics`)
      .transition()
      .duration(350)
      .delay(150)
      .style("opacity", 1);

    panel.append("text")
      .attr("x", panelWidth / 2)
      .attr("y", 42)
      .attr("text-anchor", "middle")
      .style("font-size", "12px")
      .style("opacity", 0)
      .text(`Total Positive Tests: ${stats.total}`)
      .transition()
      .duration(350)
      .delay(250)
      .style("opacity", 1);

    // 2 × 2 legend grid (narrow & tall panel)
    const legendCols = 2;
    const cellWidth = panelWidth / legendCols;
    const cellHeight = 28;

    roadsideDrugs.forEach((drug, i) => {
      const col = i % legendCols;
      const row = Math.floor(i / legendCols);

      const group = panel.append("g")
        .attr("transform", `translate(${col * cellWidth + 12}, ${58 + row * cellHeight})`)
        .style("opacity", 0);

      group.append("circle")
        .attr("r", 6)
        .attr("fill", drugColors[drug]);

      group.append("text")
        .attr("x", 12)
        .attr("y", 4)
        .style("font-size", "10px")
        .text(drug);

      group.append("text")
        .attr("x", 12)
        .attr("y", 16)
        .style("font-size", "9px")
        .style("fill", "#666")
        .text(`${stats[drug]}%`);

      group.transition()
        .duration(300)
        .delay(350 + i * 150)
        .style("opacity", 1);
    });
  });

  // Labels on map
  mapGroup.selectAll(".state-label")
    .data(geoData.features)
    .join("text")
    .attr("class", "state-label")
    .attr("transform", d => `translate(${path.centroid(d)})`)
    .attr("text-anchor", "middle")
    .style("font-size", "8px")
    .style("font-weight", "bold")
    .text(d => d.properties.STATE_NAME);

  // Notes (two separate lines)
  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 22)
    .attr("text-anchor", "middle")
    .style("font-size", "10px")
    .style("fill", "#555")
    .text("Data prior to 2021 and NT (2023–2024) unavailable. NSW confirmatory testing stopped in Sept 2024.");

  svg.append("text")
    .attr("x", width / 2)
    .attr("y", height - 8)
    .attr("text-anchor", "middle")
    .style("font-size", "10px")
    .style("fill", "#555")
    .text("ACT is omitted due to constraints in displaying its location at this map scale.");
}
