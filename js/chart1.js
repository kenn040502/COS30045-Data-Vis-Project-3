// js/chart1.js
// Chart 1 - Pareto chart of total positive counts by jurisdiction (2008-2024)

(async function () {
  let rows;
  try {
    rows = await d3.csv("data/Chart1Data.csv");
  } catch (err) {
    console.error("chart1 - CSV load error:", err);
    d3.select("#chart1")
      .append("div")
      .style("padding", "0.75rem")
      .style("font-size", "0.8rem")
      .text("Could not load Chart1Data.csv for jurisdiction chart.");
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

  const agg = rows
    .map(d => {
      const jurisdiction = (d.JURISDICTION || d.jurisdiction || "").trim();
      const total = +(
        d["Sum(COUNT)"] ||
        d.total ||
        d.count ||
        d.POSITIVE_COUNT ||
        d.positive_count ||
        0
      );

      return {
        jurisdiction,
        total,
        name: jurisToStateName[jurisdiction] || jurisdiction
      };
    })
    .filter(d => d.jurisdiction && d.total > 0);

  agg.sort((a, b) => d3.descending(a.total, b.total));

  const grandTotal = d3.sum(agg, d => d.total) || 1;
  let running = 0;
  agg.forEach(d => {
    running += d.total;
    d.cumPct = (running / grandTotal) * 100;
  });

  const container = d3.select("#chart1");
  container.style("position", "relative");
  container.selectAll("*").remove();
  const infoBox = d3.select("#chart1-info");

  const defaultInfoText = "Click a bar to see totals.";

  const tooltip = container
    .append("div")
    .style("position", "absolute")
    .style("background", "rgba(0,0,0,0.85)")
    .style("color", "#fff")
    .style("padding", "6px 10px")
    .style("border-radius", "6px")
    .style("font-size", "0.8rem")
    .style("pointer-events", "none")
    .style("box-shadow", "0 8px 16px rgba(0,0,0,0.25)")
    .style("opacity", 0);

  let selectedJurisdiction = null;

  function showTooltip(d, coords, { includeTotal = true } = {}) {
    const [mx, my] = coords;
    const totalLine = includeTotal ? `Total positives: ${d.total.toLocaleString()}<br>` : "";

    tooltip
      .style("opacity", 1)
      .html(
        `<strong>${d.jurisdiction} - ${d.name}</strong><br>` +
        totalLine +
        `Cumulative: ${d.cumPct.toFixed(1)}%`
      )
      .style("left", (mx + 8) + "px")
      .style("top", (my - 18) + "px");
  }

  function dimTo(targetJurisdiction) {
    svg.selectAll("rect.bar")
      .attr("opacity", b => {
        if (!targetJurisdiction) return 0.9;
        return b.jurisdiction === targetJurisdiction ? 1 : 0.35;
      });

    svg.selectAll("circle.pareto-point")
      .attr("opacity", b => {
        if (!targetJurisdiction) return 1;
        return b.jurisdiction === targetJurisdiction ? 1 : 0.4;
      });
  }

  function applySelection(targetJurisdiction) {
    if (!targetJurisdiction) {
      selectedJurisdiction = null;
      svg.selectAll("rect.bar").classed("selected", false);
      svg.selectAll("circle.pareto-point").classed("selected", false);
      dimTo(null);
      return;
    }

    selectedJurisdiction = targetJurisdiction;

    svg.selectAll("rect.bar")
      .classed("selected", b => b.jurisdiction === targetJurisdiction);

    svg.selectAll("circle.pareto-point")
      .classed("selected", b => b.jurisdiction === targetJurisdiction);

    dimTo(targetJurisdiction);
  }

  const bounds = container.node().getBoundingClientRect();
  const width = bounds.width || window.innerWidth;
  const height = bounds.height || Math.max(window.innerHeight - 160, 420);
  const margin = { top: 20, right: 50, bottom: 70, left: 75 };

  const svg = container
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("width", "100%")
    .attr("height", height);

  const x = d3.scaleBand()
    .domain(agg.map(d => d.jurisdiction))
    .range([margin.left, width - margin.right])
    .padding(0.3);

  const yLeft = d3.scaleLinear()
    .domain([0, d3.max(agg, d => d.total) || 1])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const yRight = d3.scaleLinear()
    .domain([0, 100])
    .range([height - margin.bottom, margin.top]);

  function updateInfo(jur) {
    const selected = agg.find(d => d.jurisdiction === jur);
    if (selected) {
      infoBox.html(
        `<strong>${selected.jurisdiction} - ${selected.name}</strong>: ` +
        `${selected.total.toLocaleString()} positives ` +
        `(${selected.cumPct.toFixed(1)}% cumulative)`
      );
    } else {
      infoBox.text(defaultInfoText);
    }
  }

  // Bars with grow-in animation
  const bars = svg.selectAll("rect.bar")
    .data(agg)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.jurisdiction))
    .attr("y", yLeft(0))
    .attr("width", x.bandwidth())
    .attr("height", 0)
    .attr("fill", "#00176B")
    .attr("opacity", 0.9)
    .style("cursor", "pointer")
    .on("mouseenter", (event, d) => {
      const coords = d3.pointer(event, container.node());
      dimTo(d.jurisdiction);
      showTooltip(d, coords);
      updateInfo(d.jurisdiction);
    })
    .on("mousemove", (event, d) => {
      const coords = d3.pointer(event, container.node());
      showTooltip(d, coords);
    })
    .on("mouseleave", () => {
      dimTo(selectedJurisdiction);
      tooltip.style("opacity", 0);
    })
    .on("click", (event, d) => {
      if (selectedJurisdiction === d.jurisdiction) {
        applySelection(null);
        updateInfo(null);
        tooltip.style("opacity", 0);
        return;
      }
      applySelection(d.jurisdiction);
      showTooltip(d, d3.pointer(event, container.node()));
      updateInfo(d.jurisdiction);
    });

  bars.transition()
    .duration(800)
    .delay((_, i) => i * 60)
    .ease(d3.easeCubicOut)
    .attr("y", d => yLeft(d.total))
    .attr("height", d => height - margin.bottom - yLeft(d.total));

  // Pareto line with stroke-draw animation
  const line = d3.line()
    .x(d => x(d.jurisdiction) + x.bandwidth() / 2)
    .y(d => yRight(d.cumPct))
    .curve(d3.curveMonotoneX);

  const paretoPath = svg.append("path")
    .datum(agg)
    .attr("fill", "none")
    .attr("stroke", "#f97316")
    .attr("stroke-width", 2)
    .attr("d", line);

  const totalLen = paretoPath.node().getTotalLength();
  paretoPath
    .attr("stroke-dasharray", `${totalLen} ${totalLen}`)
    .attr("stroke-dashoffset", totalLen)
    .transition()
    .duration(900)
    .delay(200)
    .ease(d3.easeCubicOut)
    .attr("stroke-dashoffset", 0);

  const paretoPoints = svg.selectAll("circle.pareto-point")
    .data(agg)
    .enter()
    .append("circle")
    .attr("class", "pareto-point")
    .attr("cx", d => x(d.jurisdiction) + x.bandwidth() / 2)
    .attr("cy", d => yRight(d.cumPct))
    .attr("r", 0)
    .attr("fill", "#f97316")
    .style("cursor", "pointer")
    .on("mouseenter", (event, d) => {
      const coords = d3.pointer(event, container.node());
      dimTo(d.jurisdiction);
      showTooltip(d, coords, { includeTotal: false });
      updateInfo(d.jurisdiction);
    })
    .on("mousemove", (event, d) => {
      const coords = d3.pointer(event, container.node());
      showTooltip(d, coords, { includeTotal: false });
    })
    .on("mouseleave", () => {
      dimTo(selectedJurisdiction);
      tooltip.style("opacity", 0);
    })
    .on("click", (event, d) => {
      if (selectedJurisdiction === d.jurisdiction) {
        applySelection(null);
        updateInfo(null);
        tooltip.style("opacity", 0);
        return;
      }
      applySelection(d.jurisdiction);
      showTooltip(d, d3.pointer(event, container.node()), { includeTotal: false });
      updateInfo(d.jurisdiction);
    });

  paretoPoints
    .transition()
    .duration(600)
    .delay((_, i) => 250 + i * 60)
    .ease(d3.easeBackOut)
    .attr("r", 3);

  // Axes
  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-20)")
    .style("text-anchor", "end")
    .style("font-size", "10px");

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(yLeft).ticks(6).tickFormat(d3.format(",")))
    .append("text")
    .attr("x", -margin.left + 5)
    .attr("y", margin.top - 10)
    .attr("fill", "#00176B")
    .attr("text-anchor", "start")
    .style("font-size", "11px")
    .text("Total positives");

  svg.append("g")
    .attr("transform", `translate(${width - margin.right},0)`)
    .call(d3.axisRight(yRight).ticks(5).tickFormat(d => d + "%"))
    .append("text")
    .attr("x", 35)
    .attr("y", margin.top - 10)
    .attr("fill", "#00176B")
    .attr("text-anchor", "end")
    .style("font-size", "11px")
    .text("Cumulative %");

  svg.append("line")
    .attr("x1", margin.left)
    .attr("x2", width - margin.right)
    .attr("y1", yRight(80))
    .attr("y2", yRight(80))
    .attr("stroke", "rgba(0, 23, 107, 0.3)")
    .attr("stroke-dasharray", "4 4");

  svg.append("text")
    .attr("x", width - margin.right - 4)
    .attr("y", yRight(80) - 4)
    .attr("text-anchor", "end")
    .style("font-size", "10px")
    .style("fill", "rgba(0, 23, 107, 0.6)")
    .text("80% cumulative");

  // Seed the info panel with the top jurisdiction
  if (agg.length) {
    updateInfo(agg[0].jurisdiction);
  }
})();
