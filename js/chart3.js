// js/chart3.js
// Chart 3 – Stacked area chart of detection methods over time (2008–2024)

(async function () {
  let rows;
  try {
    rows = await d3.csv("cleanedData.csv");
  } catch (err) {
    console.error("chart3 – CSV load error:", err);
    d3.select("#chart3")
      .append("div")
      .style("padding", "0.75rem")
      .style("font-size", "0.8rem")
      .text("Could not load cleanedData.csv for detection chart.");
    return;
  }

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
      stage = "Stage 1 – Indicator";
    } else if (detLower.includes("confirm") || detLower.includes("stage 2")) {
      stage = "Stage 2 – Confirmatory";
    } else if (
      detLower.includes("lab") ||
      detLower.includes("toxicology") ||
      detLower.includes("stage 3")
    ) {
      stage = "Stage 3 – Laboratory";
    } else {
      stage = "Other / NA";
    }
    d.stage = stage;
  });

  const validStages = [
    "Stage 1 – Indicator",
    "Stage 2 – Confirmatory",
    "Stage 3 – Laboratory"
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

  const width = container.node().clientWidth || 520;
  const height = 320;
  const margin = { top: 25, right: 20, bottom: 60, left: 70 };

  const svg = container
    .append("svg")
    .attr("width", width)
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
      "rgba(0, 23, 107, 0.6)",
      "rgba(0, 23, 107, 0.3)"
    ]);

  const area = d3.area()
    .x((d, i) => x(dataByYear[i].year))
    .y0(d => y(d[0]))
    .y1(d => y(d[1]))
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
    .attr("fill-opacity", 0.8)
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 0.7)
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
    infoBox.html(`<strong>${year}</strong> – ${parts.join("; ")}`);
  }

  // selection line
  const selectionLine = svg.append("line")
    .attr("class", "selection-line")
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
    .attr("transform", `translate(${width - 200},${margin.top})`);

  validStages.forEach((stage, i) => {
    const gRow = legend
      .append("g")
      .attr("transform", `translate(0,${i * 18})`);

    gRow.append("rect")
      .attr("x", 0)
      .attr("y", -10)
      .attr("width", 12)
      .attr("height", 12)
      .attr("fill", color(stage));

    gRow.append("text")
      .attr("x", 18)
      .attr("y", 0)
      .text(stage)
      .style("font-size", "10px")
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
    })
    .on("mouseleave", () => {
      tooltip.style("opacity", 0);
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
})();
