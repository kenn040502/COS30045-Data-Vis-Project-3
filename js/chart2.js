// js/chart2.js
// Chart 2 - Layered area chart of detection methods over time (2008-2024)

(async function () {
  const container = d3.select("#chart2");
  if (container.empty()) return;
  const infoBox = d3.select("#chart2-info");
  const defaultInfoText = "Click to lock onto a year.";

  let rows;
  try {
    rows = await d3.csv("data/Chart2Data.csv");
  } catch (err) {
    console.error("chart2 - CSV load error:", err);
    container
      .append("div")
      .style("padding", "0.75rem")
      .style("font-size", "0.8rem")
      .text("Could not load Chart2Data.csv for detection chart.");
    return;
  }

  const stageColumns = [
    { key: "Indicator (Stage 1)+Sum(Sum(COUNT))", stage: "Stage 1 - Indicator" },
    { key: "Confirmatory (Stage 2)+Sum(Sum(COUNT))", stage: "Stage 2 - Confirmatory" }, // show even if all zeros
    { key: "Laboratory or Toxicology (Stage 3)+Sum(Sum(COUNT))", stage: "Stage 3 - Laboratory" }
  ];

  const dataByYear = rows
    .map(d => {
      const year = +(d.YEAR || d.Year || d.year || 0);
      const record = { year };
      stageColumns.forEach(({ key, stage }) => {
        record[stage] = +d[key] || 0;
      });
      return record;
    })
    .filter(d => d.year);

  dataByYear.sort((a, b) => d3.ascending(a.year, b.year));

  const validStages = stageColumns.map(({ stage }) => stage);

  if (!dataByYear.length) {
    container
      .append("div")
      .style("padding", "0.75rem")
      .style("font-size", "0.8rem")
      .text("No detection method data available in Chart2Data.csv.");
    return;
  }

  // Base opacities to keep upper layers visible by default
  const stageOpacity = {
    "Stage 1 - Indicator": 0.35,
    "Stage 2 - Confirmatory": 0.72,
    "Stage 3 - Laboratory": 0.55
  };

  const years = dataByYear.map(d => d.year);
  const yearIndex = new Map(years.map((y, i) => [y, i]));

  // Build individual series for each stage (not stacked)
  const stageSeries = validStages.map(stage => ({
    stage,
    values: dataByYear.map(d => ({ year: d.year, value: d[stage] || 0 }))
  }));

  let selectedIndex = null;
  let selectedStage = null;

  container.selectAll("*").remove();

  const bounds = container.node().getBoundingClientRect();
  const width = Math.min(bounds.width || window.innerWidth, 1200);
  const height = bounds.height || Math.max(window.innerHeight - 160, 450);
  const margin = { top: 25, right: 20, bottom: 60, left: 70 };

  const svg = container
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .attr("width", width)
    .attr("height", height)
    .style("margin", "0 auto")
    .style("display", "block");

  const x = d3.scalePoint()
    .domain(years)
    .range([margin.left, width - margin.right])
    .padding(0.2);

  const maxY = d3.max(stageSeries, s => d3.max(s.values, v => v.value)) || 1;

  const y = d3.scaleLinear()
    .domain([0, maxY])
    .nice()
    .range([height - margin.bottom, margin.top]);

  const color = d3.scaleOrdinal()
    .domain(validStages)
    .range([
      "#001f4d",  // Stage 1 - navy
      "#1F7A8C",  // Stage 2 - teal
      "#F4A261"   // Stage 3 - amber
    ]);

  const area = d3.area()
    .x(d => x(d.year))
    .y0(() => y(0))
    .y1(d => y(d.value))
    .curve(d3.curveMonotoneX);

  const areaZero = d3.area()
    .x(d => x(d.year))
    .y0(() => y(0))
    .y1(() => y(0))
    .curve(d3.curveMonotoneX);

  const stageGroup = svg.append("g")
    .attr("class", "stage-group");

  const containerNode = container.node();
  const svgNode = svg.node();

  // Draw order: Stage 1 (back), Stage 3 (middle), Stage 2 (front)
  const renderOrder = [
    "Stage 1 - Indicator",
    "Stage 3 - Laboratory",
    "Stage 2 - Confirmatory"
  ];
  const renderingSeries = renderOrder
    .map(stage => stageSeries.find(s => s.stage === stage))
    .filter(Boolean);

  const stagePaths = stageGroup.selectAll("path.stage-area")
    .data(renderingSeries)
    .enter()
    .append("path")
    .attr("class", "stage-area")
    .attr("fill", d => color(d.stage))
    .attr("fill-opacity", d => stageOpacity[d.stage] ?? 0.5)
    .attr("stroke", d => color(d.stage))
    .attr("stroke-width", 1.4)
    .attr("d", d => areaZero(d.values));

  stagePaths
    .transition()
    .duration(900)
    .delay((_, i) => i * 140)
    .ease(d3.easeCubicOut)
    .attr("d", d => area(d.values));

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
    infoBox.html(`<strong>${year}</strong> - ${parts.join("; ")}`);
  }

  function renderSelection() {
    if (selectedIndex === null) {
      selectionLine.style("display", "none");
      xAxisText.classed("selected", false);
      setActiveStage(null);
      infoBox.text(defaultInfoText);
      return;
    }

    const year = years[selectedIndex];
    const xPos = x(year);

    selectionLine
      .style("display", null)
      .attr("x1", xPos)
      .attr("x2", xPos)
      .attr("y1", margin.top)
      .attr("y2", height - margin.bottom);

    xAxisText.classed("selected", d => d === year);
    setActiveStage(selectedStage);
    updateInfoForIndex(selectedIndex);
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

  const legendRows = legend.selectAll("g.legend-row")
    .data(validStages)
    .enter()
    .append("g")
    .attr("class", "legend-row")
    .attr("transform", (_, i) => `translate(0, ${i * 26})`);

  legendRows.append("rect")
    .attr("x", 0)
    .attr("y", -12)
    .attr("width", 16)
    .attr("height", 16)
    .attr("fill", d => color(d));

  legendRows.append("text")
    .attr("x", 24)
    .attr("y", 0)
    .text(d => d)
    .style("font-size", "13px")
    .style("font-weight", "600")
    .attr("alignment-baseline", "middle")
    .attr("fill", "#1f2937");

  legendRows
    .on("mouseenter", (_, d) => setActiveStage(d))
    .on("mouseleave", () => setActiveStage(null));

  function setActiveStage(stageKey) {
    stagePaths
      .attr("fill-opacity", d => {
        const base = stageOpacity[d.stage] ?? 0.5;
        if (!stageKey) return base;
        return d.stage === stageKey ? Math.min(1, base + 0.25) : base * 0.35;
      })
      .attr("stroke-width", d => stageKey && d.stage === stageKey ? 2 : 1.4);

    legendRows.selectAll("rect")
      .attr("opacity", 1);

    legendRows.selectAll("text")
      .attr("font-weight", d => d === stageKey ? 700 : 600)
      .attr("fill", d => d === stageKey ? "#00176B" : "#1f2937");

    if (stageKey) {
      stagePaths.filter(d => d.stage === stageKey).raise();
    }
  }

  // Hover / click capture
  svg.append("rect")
    .attr("class", "hover-capture")
    .attr("x", margin.left)
    .attr("y", margin.top)
    .attr("width", width - margin.left - margin.right)
    .attr("height", height - margin.top - margin.bottom)
    .attr("fill", "transparent")
    .on("mousemove", function (event) {
      const [mx, my] = d3.pointer(event, svgNode);
      const idx = nearestYearIndex(mx);
      const year = years[idx];
      const valueAtPointer = y.invert(my);

      let activeStage = null;
      let closestDiff = Infinity;
      stageSeries.forEach(s => {
        const val = s.values[idx].value;
        const diff = Math.abs(val - valueAtPointer);
        if (diff < closestDiff) {
          closestDiff = diff;
          activeStage = s.stage;
        }
      });

      let html = `<strong>${year}</strong><br>`;
      validStages.forEach(stage => {
        const val = dataByYear[idx][stage] || 0;
        html += `${stage}: ${val.toLocaleString()}<br>`;
      });

      const rect = containerNode.getBoundingClientRect();
      tooltip
        .style("opacity", 1)
        .html(html)
        .style("left", event.clientX - rect.left + 8 + "px")
        .style("top", event.clientY - rect.top + 8 + "px");

      updateInfoForIndex(idx);

      const highlightYears = new Set(selectedIndex === null ? [] : [years[selectedIndex]]);
      highlightYears.add(year);

      xAxisText.classed("selected", d => highlightYears.has(d));

      const xPos = x(year);
      selectionLine
        .style("display", null)
        .attr("x1", xPos)
        .attr("x2", xPos)
        .attr("y1", margin.top)
        .attr("y2", height - margin.bottom);

      setActiveStage(activeStage);
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
      renderSelection();
    })
    .on("click", (event) => {
      const [mx, my] = d3.pointer(event, svgNode);
      const idx = nearestYearIndex(mx);
      const year = years[idx];
      const valueAtPointer = y.invert(my);

      let activeStage = null;
      let closestDiff = Infinity;
      stageSeries.forEach(s => {
        const val = s.values[idx].value;
        const diff = Math.abs(val - valueAtPointer);
        if (diff < closestDiff) {
          closestDiff = diff;
          activeStage = s.stage;
        }
      });

      if (selectedIndex === idx) {
        selectedIndex = null;
        selectedStage = null;
        renderSelection();
        tooltip.style("opacity", 0);
        return;
      }

      selectedIndex = idx;
      selectedStage = activeStage;
      renderSelection();
    });

  // Seed info panel with the latest year
  if (dataByYear.length) {
    updateInfoForIndex(dataByYear.length - 1);
  }
})();
