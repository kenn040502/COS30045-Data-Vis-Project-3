// js/chart3.js
// Chart 3 - Stacked area chart of detection methods over time (2008-2024)

(async function () {
  let rows;
  try {
    rows = await d3.csv("data/cleanedData.csv");
  } catch (err) {
    console.error("chart3 - CSV load error:", err);
    d3.select("#chart3")
      .append("div")
      .style("padding", "0.75rem")
      .style("font-size", "0.8rem")
      .text("Could not load cleanedData.csv for detection chart.");
    return;
  }

  // Parse and categorise detection stages
  rows.forEach(d => {
    d.year = +(d.YEAR || d.year || 0);
    d.positive_count = +(
      d.COUNT ||
      d.count ||
      d.POSITIVE_COUNT ||
      d.positive_count ||
      0
    );
    const rawDet =
      (d.DETECTION_METHOD || d.DETECTION || d.detection || "").toString();
    const detLower = rawDet.toLowerCase();

    let stage;
    if (detLower.includes("indicator") || detLower.includes("stage 1")) {
      stage = "Stage 1 - Indicator";
    } else if (detLower.includes("confirm") || detLower.includes("stage 2")) {
      stage = "Stage 2 - Confirmatory";
    } else if (
      detLower.includes("lab") ||
      detLower.includes("toxicology") ||
      detLower.includes("stage 3")
    ) {
      stage = "Stage 3 - Laboratory";
    } else {
      stage = "Other / NA";
    }
    d.stage = stage;
  });

  const validStages = [
    "Stage 1 - Indicator",
    "Stage 2 - Confirmatory",
    "Stage 3 - Laboratory"
  ];

  rows = rows.filter(
    d => d.year >= 2008 && d.year <= 2024 && validStages.includes(d.stage)
  );

  const years = Array.from(new Set(rows.map(d => d.year))).sort((a, b) => a - b);

  const dataByYear = years.map(year => {
    const obj = { year };
    validStages.forEach(stage => {
      obj[stage] = 0;
    });
    return obj;
  });

  const yearIndex = new Map(years.map((y, i) => [y, i]));

  rows.forEach(d => {
    const idx = yearIndex.get(d.year);
    if (idx === undefined) return;
    dataByYear[idx][d.stage] += d.positive_count;
  });

  const stack = d3.stack()
    .keys(validStages)
    .order(d3.stackOrderNone)
    .offset(d3.stackOffsetNone);

  const series = stack(dataByYear);

  const container = d3.select("#chart3");
  container.selectAll("*").remove();
  const infoBox = d3.select("#chart3-info");

  const bounds = container.node().getBoundingClientRect();
  const width = bounds.width || window.innerWidth;
  const height = bounds.height || Math.max(window.innerHeight - 160, 450);
  const margin = { top: 25, right: 20, bottom: 60, left: 70 };

  const svg = container
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("width", "100%")
    .attr("height", height);

  const x = d3.scalePoint()
    .domain(years)
    .range([margin.left, width - margin.right])
    .padding(0.2);

  const maxY = d3.max(series, s => d3.max(s, d => d[1])) || 1;

  const y = d3.scaleLinear()
    .domain([0, maxY])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const color = d3.scaleOrdinal()
    .domain(validStages)
    .range([
      "#00176B",
      "rgba(0, 23, 107, 0.65)",
      "rgba(0, 23, 107, 0.3)"
    ]);

  const area = d3.area()
    .x((d, i) => x(dataByYear[i].year))
    .y0(d => y(d[0]))
    .y1(d => y(d[1]))
    .curve(d3.curveMonotoneX);

  const areaAtBottom = d3.area()
    .x((d, i) => x(dataByYear[i].year))
    .y0(() => y(0))
    .y1(() => y(0))
    .curve(d3.curveMonotoneX);

  const stageGroup = svg.selectAll("path.stage-area")
    .data(series)
    .enter()
    .append("g")
    .attr("class", "stage-group");

  stageGroup
    .append("path")
    .attr("class", "stage-area")
    .attr("fill", d => color(d.key))
    .attr("fill-opacity", 0.55)
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 0.7)
    .attr("d", areaAtBottom)
    .transition()
    .duration(900)
    .delay((_, i) => i * 120)
    .ease(d3.easeCubicOut)
    .attr("d", area);

  const tooltip = container
    .append("div")
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

  function nearestYearIndex(mouseX) {
    let closest = 0;
    let minDist = Infinity;
    years.forEach((year, i) => {
      const px = x(year);
      const dist = Math.abs(mouseX - px);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    return closest;
  }

  function updateInfoForIndex(idx) {
    const year = dataByYear[idx].year;
    const parts = validStages.map(stage =>
      `${stage} = ${dataByYear[idx][stage].toLocaleString()}`
    );
    infoBox.html(`<strong>${year}</strong> — ${parts.join("; ")}`);
  }

  // selection line that tracks the pointer/click
  const selectionLine = svg.append("line")
    .attr("class", "selection-line")
    .attr("stroke", "#0f172a")
    .attr("stroke-width", 1.2)
    .attr("stroke-dasharray", "4 3")
    .style("display", "none");

  // X axis (store references to ticks for selection)
  const xAxisG = svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(
      d3.axisBottom(x)
        .tickValues(years.filter((y, i) => i % 2 === 0))
        .tickFormat(d3.format("d"))
    );

  const xAxisText = xAxisG.selectAll("text")
    .style("font-size", "10px")
    .attr("class", "axis-year");

  // Y axis
  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(",")))
    .append("text")
    .attr("x", -margin.left + 5)
    .attr("y", margin.top - 10)
    .attr("fill", "#00176B")
    .attr("text-anchor", "start")
    .style("font-size", "11px")
    .text("Positive tests");

  // Legend
  const legend = svg
    .append("g")
    .attr("transform", `translate(${width - 220}, ${margin.top})`);

  validStages.forEach((stage, i) => {
    const gRow = legend
      .append("g")
      .attr("transform", `translate(0, ${i * 26})`);

    gRow.append("rect")
      .attr("x", 0)
      .attr("y", -12)
      .attr("width", 16)
      .attr("height", 16)
      .attr("fill", color(stage));

    gRow.append("text")
      .attr("x", 24)
      .attr("y", 0)
      .text(stage)
      .style("font-size", "13px")
      .style("font-weight", "600")
      .attr("alignment-baseline", "middle");
  });

  // Hover / click capture
  svg.append("rect")
    .attr("class", "hover-capture")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", width - margin.left - margin.right)
    .attr("height", height - margin.top - margin.bottom)
    .attr("fill", "transparent")
    .on("mousemove", function (event) {
      const [mx, my] = d3.pointer(event, containerNode);
      const idx = nearestYearIndex(mx);
      const year = dataByYear[idx].year;

      let html = `<strong>${year}</strong><br>`;
      validStages.forEach(stage => {
        const val = dataByYear[idx][stage] || 0;
        html += `${stage}: ${val.toLocaleString()}<br>`;
      });

      tooltip
        .style("opacity", 1)
        .html(html)
        .style("left", mx + 8 + "px")
        .style("top", my + 8 + "px");

      updateInfoForIndex(idx);

      xAxisText.classed("selected", function (d) {
        return d === year;
      });

      const xPos = x(year);
      selectionLine
        .style("display", null)
        .attr("x1", xPos)
        .attr("x2", xPos)
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom);
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
      selectionLine.style("display", "none");
      xAxisText.classed("selected", false);
    })
    .on("click", (event) => {
      const [mx] = d3.pointer(event, containerNode);
      const idx = nearestYearIndex(mx);
      const year = dataByYear[idx].year;

      updateInfoForIndex(idx);

      xAxisText.classed("selected", function (d) {
        return d === year;
      });

      const xPos = x(year);
      selectionLine
        .style("display", null)
        .attr("x1", xPos)
        .attr("x2", xPos)
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom);
    });

  // Seed info panel with the latest year
  if (dataByYear.length) {
    updateInfoForIndex(dataByYear.length - 1);
  }
})();
