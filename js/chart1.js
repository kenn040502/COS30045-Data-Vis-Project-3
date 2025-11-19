// js/chart1.js
// Chart 1 – Pareto chart of total positive counts by jurisdiction (2008–2024)

(async function () {
  let rows;
  try {
    rows = await d3.csv("cleanedData.csv");
  } catch (err) {
    console.error("chart1 – CSV load error:", err);
    d3.select("#chart1")
      .append("div")
      .style("padding", "0.75rem")
      .style("font-size", "0.8rem")
      .text("Could not load cleanedData.csv for jurisdiction chart.");
    return;
  }

  rows.forEach(d => {
    d.year = +(d.YEAR || d.year || 0);
    d.jurisdiction = (d.JURISDICTION || d.jurisdiction || "").trim();
    d.positive_count = +(
      d.COUNT ||
      d.count ||
      d.POSITIVE_COUNT ||
      d.positive_count ||
      0
    );
  });

  rows = rows.filter(d => d.year >= 2008 && d.year <= 2024 && d.jurisdiction);

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

  const agg = d3.rollups(
    rows,
    v => d3.sum(v, d => d.positive_count),
    d => d.jurisdiction
  )
    .map(([jur, total]) => ({
      jurisdiction: jur,
      total,
      name: jurisToStateName[jur] || jur
    }))
    .filter(d => d.total > 0);

  agg.sort((a, b) => d3.descending(a.total, b.total));

  const grandTotal = d3.sum(agg, d => d.total) || 1;
  let running = 0;
  agg.forEach(d => {
    running += d.total;
    d.cumPct = (running / grandTotal) * 100;
  });

  const container = d3.select("#chart1");
  container.selectAll("*").remove();
  const infoBox = d3.select("#chart1-info");

  const width = container.node().clientWidth || 500;
  const height = 320;
  const margin = { top: 20, right: 50, bottom: 70, left: 75 };

  const svg = container
    .append("svg")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("width", "100%")
    .attr("height", "100%");

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

  function selectJurisdiction(jur) {
    svg.selectAll("rect.bar")
      .classed("selected", d => d.jurisdiction === jur);

    svg.selectAll("circle.pareto-point")
      .classed("selected", d => d.jurisdiction === jur);

    const selected = agg.find(d => d.jurisdiction === jur);
    if (selected) {
      infoBox.html(
        `<strong>${selected.jurisdiction} – ${selected.name}</strong>: ` +
        `${selected.total.toLocaleString()} positives ` +
        `(${selected.cumPct.toFixed(1)}% cumulative)`
      );
    }
  }

  // Bars
  svg.selectAll("rect.bar")
    .data(agg)
    .enter()
    .append("rect")
    .attr("class", "bar")
    .attr("x", d => x(d.jurisdiction))
    .attr("y", d => yLeft(d.total))
    .attr("width", x.bandwidth())
    .attr("height", d => height - margin.bottom - yLeft(d.total))
    .attr("fill", "#00176B")
    .on("click", (event, d) => selectJurisdiction(d.jurisdiction))
    .append("title")
    .text(d =>
      `${d.jurisdiction} – ${d.name}\nTotal positives: ${d.total.toLocaleString()}`
    );

  // Pareto line
  const line = d3.line()
    .x(d => x(d.jurisdiction) + x.bandwidth() / 2)
    .y(d => yRight(d.cumPct))
    .curve(d3.curveMonotoneX);

    svg.append("path")
    .datum(agg)
    .attr("fill", "none")
    .attr("stroke", "#f97316")   // orange cumulative curve
    .attr("stroke-width", 2)
    .attr("d", line);

  // Pareto points
  svg.selectAll("circle.pareto-point")
    .data(agg)
    .enter()
    .append("circle")
    .attr("class", "pareto-point")
    .attr("cx", d => x(d.jurisdiction) + x.bandwidth() / 2)
    .attr("cy", d => yRight(d.cumPct))
    .attr("r", 3)
    .attr("fill", "#f97316") // orange points to match the curve
    .on("click", (event, d) => selectJurisdiction(d.jurisdiction))
    .append("title")
    .text(d =>
      `${d.jurisdiction} – ${d.name}\nCumulative: ${d.cumPct.toFixed(1)}%`
    );

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
})();
